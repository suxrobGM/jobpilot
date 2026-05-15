"use client";

import { useRef, type PointerEvent, type ReactElement } from "react";
import { Box } from "@mui/material";
import { useAgent } from "@/providers/agent-provider";

interface DockResizeHandleProps {
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * 4px-wide vertical strip pinned to the dock's left edge. Drag horizontally
 * to resize the expanded panel; width is clamped + persisted in
 * `AgentProvider`. Hidden when the dock is collapsed.
 */
export function DockResizeHandle(props: DockResizeHandleProps): ReactElement {
  const { onDragStart, onDragEnd } = props;
  const { expanded, setExpandedWidth } = useAgent();
  const draggingRef = useRef(false);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (!expanded) {
      return;
    }
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    onDragStart();
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) {
      return;
    }
    setExpandedWidth(window.innerWidth - e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) {
      return;
    }
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
    draggingRef.current = false;
    onDragEnd();
  };

  return (
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
  );
}
