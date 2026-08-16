"use client";

import "@xterm/xterm/css/xterm.css";
import { type ReactElement, useEffect, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal } from "@xterm/xterm";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { startSession, TERMINAL_WS_URL, type TerminalProviderId } from "@/lib/terminal";
import { connectWebSocket, type WebSocketClient } from "@/lib/websocket";
import { toBase64 } from "@/utils/base64";

const RESIZE_DEBOUNCE_MS = 220;

// ConPTY moves the cursor into place up to ~22 ms after a repaint; batching hides that jump.
const OUTPUT_HOLD_MS = 30;

const TERMINAL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SHIFT_ENTER_B64 = toBase64("\x1b[13;2u");
const CTRL_C_B64 = toBase64("\x03");

const DIM = 2;
const RED = 31;
const YELLOW = 33;

interface TerminalPanelProps {
  provider: TerminalProviderId;
}

type SendInput = (b64: string) => void;

function notice(color: number, text: string): string {
  return `\x1b[${color}m[terminal] ${text}\x1b[0m`;
}

function isCtrl(event: KeyboardEvent, code: string): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.code === code;
}

/** Shift+Enter as CSI-u, Ctrl+C copy-or-interrupt, Ctrl+V paste; everything else falls through to xterm. */
function createKeyHandler(
  terminal: Terminal,
  sendInput: SendInput,
): (event: KeyboardEvent) => boolean {
  return (event) => {
    if (event.type !== "keydown") {
      return true;
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      sendInput(SHIFT_ENTER_B64);
      return false;
    }
    if (isCtrl(event, "KeyC")) {
      // Ctrl+C only interrupts the running process; the Stop button kills the session.
      event.preventDefault();
      if (terminal.hasSelection()) {
        void navigator.clipboard?.writeText(terminal.getSelection());
      } else {
        sendInput(CTRL_C_B64);
      }
      return false;
    }
    if (isCtrl(event, "KeyV")) {
      event.preventDefault();
      void navigator.clipboard?.readText().then((text) => {
        if (text) {
          sendInput(toBase64(text));
        }
      });
      return false;
    }
    return true;
  };
}

/** Queues output and writes each hold window's chunks to xterm in one turn. */
function createOutputWriter(terminal: Terminal): {
  write: (data: string | Uint8Array) => void;
  cancel: () => void;
} {
  let held: (string | Uint8Array)[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    timer = null;
    const chunks = held;
    held = [];
    for (const chunk of chunks) {
      terminal.write(chunk);
    }
  };

  return {
    write(data) {
      held.push(data);
      timer ??= setTimeout(flush, OUTPUT_HOLD_MS);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
      }
    },
  };
}

/** Authenticates and starts the host session; on failure writes the reason and resolves false. */
async function openSession(
  terminal: Terminal,
  fit: FitAddon,
  provider: TerminalProviderId,
  signal: AbortSignal,
): Promise<boolean> {
  terminal.writeln(notice(DIM, "connecting…"));

  const { data, error } = await api.auth.tokens.terminal.post();
  if (signal.aborted) {
    return false;
  }
  if (error) {
    terminal.writeln(
      notice(
        RED,
        `couldn't authenticate the agent - sign in to JobPilot, then restart the terminal. (${error.value.message})`,
      ),
    );
    return false;
  }

  try {
    fit.fit();
    await startSession({
      cols: terminal.cols,
      rows: terminal.rows,
      provider,
      apiToken: data.token,
      webUrl: window.location.origin,
      apiUrl: API_BASE_URL,
    });
    return !signal.aborted;
  } catch (err) {
    if (signal.aborted) {
      return false;
    }
    const message = (err as Error).message;
    terminal.writeln(notice(RED, `failed to start session: ${message}`));
    if (/Failed to start '(claude|codex)'/.test(message)) {
      terminal.writeln(
        notice(
          YELLOW,
          "Install the CLI and make sure it's on PATH, then restart the JobPilot host.",
        ),
      );
    }
    return false;
  }
}

/** xterm.js bridged to a JobPilot.Terminal PTY over WebSocket; Shift+Enter sent as CSI-u `ESC[13;2u`. */
export function TerminalPanel(props: TerminalPanelProps): ReactElement {
  const { provider } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const { palette } = useTheme();
  const background = palette.surfaces.base;
  const foreground = palette.text.primary;
  const accent = palette.primary.main;

  // Retheme the live terminal in place - remounting it would wipe the visible session.
  // Declared before the mount effect so themeRef is filled by the time the terminal is created.
  const themeRef = useRef<ITheme>(undefined);
  useEffect(() => {
    const theme: ITheme = {
      background,
      foreground,
      cursor: accent,
      selectionBackground: `${accent}40`,
    };
    themeRef.current = theme;
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme;
    }
  }, [background, foreground, accent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: 13,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
      windowsPty: { backend: "conpty" },
      theme: themeRef.current,
    });
    terminalRef.current = terminal;

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);

    const abort = new AbortController();
    const output = createOutputWriter(terminal);
    let socket: WebSocketClient | null = null;

    const fitAndResize = (): void => {
      try {
        fit.fit();
        socket?.sendJson({ type: "resize", cols: terminal.cols, rows: terminal.rows });
      } catch {
        // container not laid out yet
      }
    };

    // sendJson is a no-op after the socket closes, so late key events are harmless.
    const sendInput: SendInput = (data) => {
      socket?.sendJson({ type: "input", data });
    };
    terminal.attachCustomKeyEventHandler(createKeyHandler(terminal, sendInput));
    terminal.onData((data) => sendInput(toBase64(data)));

    // socket.close() in the cleanup detaches these callbacks, so none can hit a disposed terminal.
    openSession(terminal, fit, provider, abort.signal).then((started) => {
      if (started) {
        socket = connectWebSocket(TERMINAL_WS_URL, {
          onOpen: fitAndResize,
          onBinary: output.write,
          onText: output.write,
          onClose: () => output.write(`\r\n${notice(YELLOW, "disconnected")}\r\n`),
        });
      }
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(fitAndResize, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      abort.abort();
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      observer.disconnect();
      output.cancel();
      socket?.close(1000, "panel unmounted");
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [provider]);

  return (
    <Box
      ref={containerRef}
      sx={(t) => ({
        flex: 1,
        minHeight: 0,
        backgroundColor: t.palette.surfaces.base,
        overflow: "hidden",
        position: "relative",
        px: 1,
        py: 0.5,
        "& .xterm": { height: "100%", maxWidth: "100%" },
        "& .xterm-viewport": { overscrollBehavior: "contain" },
      })}
    />
  );
}
