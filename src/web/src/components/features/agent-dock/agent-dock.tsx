"use client";

import { useState, type ReactElement } from "react";
import { Box } from "@mui/material";
import { DOCK_COLLAPSED } from "@/components/layout/shell-config";
import { useAgent } from "@/providers/agent-provider";
import { DockPanel } from "./dock-panel";
import { DockResizeHandle } from "./dock-resize-handle";
import { DockStrip } from "./dock-strip";

export function AgentDock(): ReactElement {
  const { expanded, expandedWidth } = useAgent();
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      component="aside"
      sx={(theme) => ({
        position: "relative",
        width: expanded ? expandedWidth : DOCK_COLLAPSED,
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
      <DockResizeHandle onDragStart={() => setDragging(true)} onDragEnd={() => setDragging(false)} />
      {expanded ? <DockPanel /> : <DockStrip />}
    </Box>
  );
}
