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
const STABLE_FRAMES = 3;
const TERMINAL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SHIFT_ENTER_INPUT = "\x1b[13;2u";

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    let socket: WebSocketClient | null = null;
    let disposed = false;

    const fitAndResize = (): void => {
      try {
        fit.fit();
        socket?.sendJson({ type: "resize", cols: terminal.cols, rows: terminal.rows });
      } catch {
        // container not laid out yet
      }
    };

    const waitForStableSize = (): Promise<void> =>
      new Promise((resolve) => {
        let lastWidth = -1;
        let lastHeight = -1;
        let stableFrames = 0;
        const tick = (): void => {
          if (disposed) return resolve();
          const width = container.offsetWidth;
          const height = container.offsetHeight;
          if (width > 0 && height > 0 && width === lastWidth && height === lastHeight) {
            if (++stableFrames >= STABLE_FRAMES) return resolve();
          } else {
            stableFrames = 0;
            lastWidth = width;
            lastHeight = height;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    const start = async (): Promise<void> => {
      await waitForStableSize();
      if (disposed) return;

      try {
        fit.fit();
        await startSession({ cols: terminal.cols, rows: terminal.rows, provider });
      } catch (err) {
        terminal.writeln(
          `\x1b[31m[terminal] failed to start session: ${(err as Error).message}\x1b[0m`,
        );
        return;
      }
      if (disposed) return;

      socket = connectWebSocket(TERMINAL_WS_URL, {
        onOpen: () => fitAndResize(),
        onBinary: (data) => terminal.write(data),
        onText: (data) => terminal.write(data),
        onClose: () => terminal.write("\r\n\x1b[33m[terminal] disconnected\x1b[0m\r\n"),
      });

      terminal.attachCustomKeyEventHandler((event) => {
        if (event.type === "keydown" && event.key === "Enter" && event.shiftKey) {
          event.preventDefault();
          socket?.sendJson({ type: "input", data: toBase64(SHIFT_ENTER_INPUT) });
          return false;
        }
        return true;
      });

      terminal.onData((data) => {
        socket?.sendJson({ type: "input", data: toBase64(data) });
      });
    };

    start();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitAndResize, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
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
        "& .xterm": { height: "100%", maxWidth: "100%" },
        "& .xterm-viewport": { overscrollBehavior: "contain" },
      })}
    />
  );
}
