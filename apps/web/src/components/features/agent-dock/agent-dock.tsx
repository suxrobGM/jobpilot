"use client";

import {
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Box } from "@mui/material";
import {
  patchAgentStorage,
  readAgentStorage,
  subscribeAgentStorage,
} from "@/lib/terminal/agent-storage";
import { useAgentDock } from "@/providers/agent-provider";
import { clamp } from "@/utils/math";
import { DockPanel } from "./dock-panel";
import { DockStrip } from "./dock-strip";

const DOCK_COLLAPSED = 56;
const DOCK_EXPANDED = 380;
const DOCK_MIN_EXPANDED = 320;
const DOCK_MAX_EXPANDED = 640;

function readStoredDockWidth(): number {
  const width = readAgentStorage()?.dockWidth;
  return typeof width === "number" && Number.isFinite(width)
    ? clamp(Math.round(width), DOCK_MIN_EXPANDED, DOCK_MAX_EXPANDED)
    : DOCK_EXPANDED;
}

const getServerDockWidth = (): number => DOCK_EXPANDED;

export function AgentDock(): ReactElement {
  const { expanded } = useAgentDock();
  // localStorage is the source of truth; the server snapshot keeps the read SSR-safe.
  const width = useSyncExternalStore(
    subscribeAgentStorage,
    readStoredDockWidth,
    getServerDockWidth,
  );
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  const updateWidth = (px: number): void => {
    patchAgentStorage({ dockWidth: clamp(Math.round(px), DOCK_MIN_EXPANDED, DOCK_MAX_EXPANDED) });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (!expanded) {
      return;
    }
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) {
      return;
    }
    updateWidth(window.innerWidth - e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) {
      return;
    }
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    setDragging(false);
  };

  return (
    <Box
      component="aside"
      sx={(theme) => ({
        position: "relative",
        width: expanded ? width : DOCK_COLLAPSED,
        flexShrink: 0,
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderLeft: 1,
        borderColor: "divider",
        backgroundColor: theme.palette.surfaces.base,
        transition: dragging ? "none" : `width ${theme.motion.expressive}`,
      })}
    >
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent dock"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={(theme) => ({
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          marginLeft: "-2px",
          cursor: expanded ? "col-resize" : "default",
          pointerEvents: expanded ? "auto" : "none",
          zIndex: 2,
          backgroundColor: "transparent",
          transition: `background-color ${theme.motion.fast}`,
          "&:hover, &:active": {
            backgroundColor: theme.palette.accent.primary,
          },
        })}
      />
      {expanded ? <DockPanel /> : <DockStrip />}
    </Box>
  );
}
