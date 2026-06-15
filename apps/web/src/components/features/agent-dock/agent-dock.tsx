"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactElement,
} from "react";
import { Box } from "@mui/material";
import {
  DOCK_COLLAPSED,
  DOCK_EXPANDED,
  DOCK_MAX_EXPANDED,
  DOCK_MIN_EXPANDED,
} from "@/components/layout/shell-config";
import {
  patchAgentStorage,
  readAgentStorage,
  subscribeAgentStorage,
  useAgentDock,
} from "@/providers/agent-provider";
import { clamp } from "@/utils/math";
import { DockPanel } from "./dock-panel";
import { DockStrip } from "./dock-strip";

function getStoredDockWidth(): number {
  const w = readAgentStorage()?.dockWidth;
  return typeof w === "number" && Number.isFinite(w)
    ? clamp(Math.round(w), DOCK_MIN_EXPANDED, DOCK_MAX_EXPANDED)
    : DOCK_EXPANDED;
}

const getServerDockWidth = (): number => DOCK_EXPANDED;

export function AgentDock(): ReactElement {
  const { expanded } = useAgentDock();
  // Persisted dock width lives in localStorage (source of truth); reads stay
  // SSR-safe via useSyncExternalStore's server snapshot.
  const width = useSyncExternalStore(subscribeAgentStorage, getStoredDockWidth, getServerDockWidth);
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
        borderLeft: `1px solid ${theme.palette.line.divider}`,
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
