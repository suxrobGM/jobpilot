"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, type ReactElement } from "react";
import { Box, useTheme } from "@mui/material";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { api } from "@/api/eden";
import { startSession, TERMINAL_WS_URL, type TerminalProviderId } from "@/lib/terminal";
import { connectWebSocket, type WebSocketClient } from "@/lib/websocket";
import { toBase64 } from "@/utils/base64";

const RESIZE_DEBOUNCE_MS = 220;
const TERMINAL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SHIFT_ENTER_B64 = toBase64("\x1b[13;2u");
const CTRL_C_B64 = toBase64("\x03");

interface TerminalPanelProps {
  provider: TerminalProviderId;
}

/**
 * xterm.js instance bridged to a JobPilot.Terminal provider PTY over WebSocket.
 *
 * Waits for the container size to settle before the initial fit so the first
 * resize sent to a still-running PTY isn't the dock's mid-transition width.
 * Shift+Enter is forwarded as CSI-u `ESC[13;2u` instead of a newline.
 */
export function TerminalPanel(props: TerminalPanelProps): ReactElement {
  const { provider } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  const background = theme.palette.surfaces.base;
  const foreground = theme.palette.text.primary;
  const cursor = theme.palette.primary.main;
  const selection = `${theme.palette.primary.main}40`;

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
      windowsPty: { backend: "winpty" },
      theme: { background, foreground, cursor, selectionBackground: selection },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);

    let socket: WebSocketClient | null = null;
    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    // Last size sent to the PTY. A redundant resize makes the provider TUI
    // repaint, and on reattach those repeated repaints stack into duplicate
    // banners. Starts at 0 so the first post-connect resize always fires once.
    let lastCols = 0;
    let lastRows = 0;

    const sendResize = (): void => {
      try {
        fit.fit();
      } catch {
        return; // container not laid out yet
      }
      if (terminal.cols === lastCols && terminal.rows === lastRows) {
        return;
      }
      lastCols = terminal.cols;
      lastRows = terminal.rows;
      socket?.sendJson({ type: "resize", cols: terminal.cols, rows: terminal.rows });
    };

    // Debounce so a dock-open animation or hydration size flip sends one resize
    // at the settled width, not one repaint-triggering resize per frame.
    const scheduleResize = (): void => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(sendResize, RESIZE_DEBOUNCE_MS);
    };

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        socket?.sendJson({ type: "input", data: SHIFT_ENTER_B64 });
        return false;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === "KeyC") {
        // Copy when there's a selection, otherwise forward a single interrupt.
        // Ctrl+C only interrupts the running process; the Stop button kills the session.
        if (terminal.hasSelection()) {
          event.preventDefault();
          void navigator.clipboard?.writeText(terminal.getSelection());
          return false;
        }

        event.preventDefault();
        socket?.sendJson({ type: "input", data: CTRL_C_B64 });
        return false;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === "KeyV") {
        event.preventDefault();
        void navigator.clipboard?.readText().then((text) => {
          if (text && !disposed) {
            socket?.sendJson({ type: "input", data: toBase64(text) });
          }
        });
        return false;
      }
      return true;
    });

    terminal.onData((data) => {
      socket?.sendJson({ type: "input", data: toBase64(data) });
    });

    const start = async (): Promise<void> => {
      // Fetch the token while the container settles — it's independent of terminal size.
      const tokenPromise = api.auth.tokens.terminal.post();

      if (disposed) {
        return;
      }

      const { data, error } = await tokenPromise;
      if (error) {
        terminal.writeln(
          `\x1b[31m[terminal] couldn't authenticate the agent — sign in to JobPilot, then restart the terminal. (${error.value.message})\x1b[0m`,
        );
        return;
      }

      try {
        fit.fit();
        await startSession({
          cols: terminal.cols,
          rows: terminal.rows,
          provider,
          apiToken: data.token,
        });
      } catch (err) {
        terminal.writeln(
          `\x1b[31m[terminal] failed to start session: ${(err as Error).message}\x1b[0m`,
        );
        return;
      }

      socket = connectWebSocket(TERMINAL_WS_URL, {
        onOpen: () => scheduleResize(),
        onBinary: (data) => {
          terminal.write(data);
        },
        onText: (data) => {
          terminal.write(data);
        },
        onClose: () => {
          terminal.write("\r\n\x1b[33m[terminal] disconnected\x1b[0m\r\n");
        },
      });
    };

    start();

    const observer = new ResizeObserver(() => scheduleResize());
    observer.observe(container);

    return () => {
      disposed = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      observer.disconnect();
      socket?.close(1000, "panel unmounted");
      terminal.dispose();
    };
  }, [provider, background, foreground, cursor, selection]);

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
