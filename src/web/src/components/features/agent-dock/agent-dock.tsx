"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { DOCK_COLLAPSED, DOCK_EXPANDED } from "@/components/layout/shell-config";
import { useAgent } from "@/providers/agent-provider";
import { DockPanel } from "./dock-panel";
import { DockStrip } from "./dock-strip";

export function AgentDock(): ReactElement {
  const { expanded } = useAgent();
  return (
    <Box
      component="aside"
      sx={(theme) => ({
        width: expanded ? DOCK_EXPANDED : DOCK_COLLAPSED,
        flexShrink: 0,
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderLeft: `1px solid ${theme.palette.line.divider}`,
        backgroundColor: theme.palette.surfaces.base,
        transition: `width ${theme.motion.expressive}`,
      })}
    >
      {expanded ? <DockPanel /> : <DockStrip />}
    </Box>
  );
}
