"use client";

import {
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Box, Drawer } from "@mui/material";
import {
  patchAgentStorage,
  readAgentStorage,
  subscribeAgentStorage,
} from "@/lib/terminal/agent-storage";
import { useAgentDrawer } from "@/providers/agent-provider";
import { clamp } from "@/utils/math";
import { AgentPanel } from "./agent-panel";

const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 360;
const MAX_WIDTH = 960;

function readStoredWidth(): number {
  const width = readAgentStorage()?.drawerWidth;
  return typeof width === "number" && Number.isFinite(width)
    ? clamp(Math.round(width), MIN_WIDTH, MAX_WIDTH)
    : DEFAULT_WIDTH;
}

const getServerWidth = (): number => DEFAULT_WIDTH;

/** The agent's status and terminal, over the page on demand; the page stays usable beside it. */
export function AgentDrawer(): ReactElement {
  const { drawerOpen } = useAgentDrawer();
  // localStorage is the source of truth; the server snapshot keeps the read SSR-safe.
  const width = useSyncExternalStore(subscribeAgentStorage, readStoredWidth, getServerWidth);
  const dragging = useRef(false);
  const [resizing, setResizing] = useState(false);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setResizing(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragging.current) {
      const next = clamp(Math.round(window.innerWidth - e.clientX), MIN_WIDTH, MAX_WIDTH);
      patchAgentStorage({ drawerWidth: next });
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragging.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragging.current = false;
      setResizing(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      variant="persistent"
      open={drawerOpen}
      slotProps={{
        paper: {
          sx: (theme) => ({
            width,
            maxWidth: "100vw",
            borderLeft: 1,
            borderColor: "divider",
            backgroundColor: theme.palette.surfaces.base,
            boxShadow: theme.shadows[8],
            // Above page content and sticky footers, below dialogs.
            zIndex: theme.zIndex.drawer,
            userSelect: resizing ? "none" : undefined,
          }),
        },
      }}
    >
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent drawer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={(theme) => ({
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: theme.spacing(0.5),
          cursor: "col-resize",
          zIndex: 2,
          transition: `background-color ${theme.motion.fast}`,
          "&:hover, &:active": { backgroundColor: theme.palette.accent.primary },
        })}
      />
      {/* Mounted only while open, so the terminal reconnects and replays its buffer on open. */}
      {drawerOpen && <AgentPanel />}
    </Drawer>
  );
}
