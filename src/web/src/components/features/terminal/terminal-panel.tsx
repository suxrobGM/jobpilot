"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, type ReactElement } from "react";
import { Box, useTheme } from "@mui/material";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { startSession, TERMINAL_WS_URL, type TerminalProviderId } from "@/lib/terminal";
import { connectWebSocket, type WebSocketClient } from "@/lib/websocket";
import { toBase64 } from "@/utils/base64";

const RESIZE_DEBOUNCE_MS = 220;
const TERMINAL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

interface TerminalPanelProps {
  provider: TerminalProviderId;
}

/**
 * Hosts the xterm.js instance that bridges browser input/output to JobPilot.Terminal.
 */
export function TerminalPanel(props: TerminalPanelProps): ReactElement {
  const { provider } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

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
      theme: {
        background: theme.palette.surfaces.base,
        foreground: theme.palette.text.primary,
        cursor: theme.palette.primary.main,
        selectionBackground: `${theme.palette.primary.main}40`,
      },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    fit.fit();

    let socket: WebSocketClient | null = null;
    let inputDisposable: { dispose: () => void } | null = null;
    let disposed = false;
    let lastCols = terminal.cols;
    let lastRows = terminal.rows;

    const writeOutput = (data: string | Uint8Array) => {
      if (!disposed) {
        terminal.write(data);
      }
    };

    const sendResize = () => {
      socket?.sendJson({ type: "resize", cols: lastCols, rows: lastRows });
    };

    const syncSize = () => {
      if (disposed) {
        return;
      }
      try {
        fit.fit();
        if (terminal.cols === lastCols && terminal.rows === lastRows) {
          return;
        }

        lastCols = terminal.cols;
        lastRows = terminal.rows;
        sendResize();
        terminal.scrollToBottom();
      } catch {
        // ignore until container is laid out
      }
    };

    const initialize = async () => {
      try {
        syncSize();
        await startSession({ cols: terminal.cols, rows: terminal.rows, provider });
      } catch (err) {
        terminal.writeln(
          `\x1b[31m[terminal] failed to start session: ${(err as Error).message}\x1b[0m`,
        );
        return;
      }

      if (disposed) {
        return;
      }

      socket = connectWebSocket(TERMINAL_WS_URL, {
        onOpen() {
          sendResize();
        },
        onBinary(data) {
          writeOutput(data);
        },
        onText(data) {
          writeOutput(data);
        },
        onClose() {
          writeOutput("\r\n\x1b[33m[terminal] disconnected\x1b[0m\r\n");
        },
      });

      inputDisposable = terminal.onData((data) => {
        socket?.sendJson({ type: "input", data: toBase64(data) });
      });
    };

    initialize();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver(() => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        syncSize();
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      disposed = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      observer.disconnect();
      inputDisposable?.dispose();
      socket?.close(1000, "panel unmounted");
      terminal.dispose();
    };
  }, [provider, theme]);

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
        "& .xterm": {
          height: "100%",
          maxWidth: "100%",
        },
        "& .xterm-viewport": {
          overscrollBehavior: "contain",
        },
      })}
    />
  );
}
