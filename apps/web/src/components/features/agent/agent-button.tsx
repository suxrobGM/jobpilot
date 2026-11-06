"use client";

import type { ReactElement } from "react";
import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";
import { type TerminalHealth, useTerminalHealth } from "@/hooks/use-terminal-health";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";

const HEALTH_LOOK: Record<TerminalHealth, { tone: PulseDotTone; label: string }> = {
  checking: { tone: "muted", label: "connecting" },
  reachable: { tone: "green", label: "ready" },
  degraded: { tone: "amber", label: "needs reinstall" },
  offline: { tone: "amber", label: "offline" },
  uninstalled: { tone: "muted", label: "not installed" },
  blocked: { tone: "amber", label: "blocked by browser" },
};

interface AgentButtonProps {
  collapsed: boolean;
}

/** The sidebar's Agent row: opens and closes the agent drawer, with the host's health beside it. */
export function AgentButton(props: AgentButtonProps): ReactElement {
  const { collapsed } = props;
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { health } = useTerminalHealth();
  const look = HEALTH_LOOK[health];

  return (
    <Tooltip title={collapsed ? `Agent · ${look.label}` : ""} placement="right" arrow>
      <ButtonBase
        aria-label={drawerOpen ? "Close agent" : "Open agent"}
        aria-pressed={drawerOpen}
        onClick={drawerOpen ? closeDrawer : openDrawer}
        sx={(theme) => ({
          justifyContent: "flex-start",
          gap: 1.5,
          height: 36,
          paddingInline: 0.75,
          borderRadius: theme.radii.sm,
          backgroundColor: drawerOpen ? theme.palette.surfaces.elevated : "transparent",
          "&:hover": { backgroundColor: theme.palette.surfaces.card },
          "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
        })}
      >
        <Box sx={{ position: "relative", display: "flex" }}>
          <AgentOrb size="lg" />
          <Box sx={{ position: "absolute", right: -2, bottom: -2, display: "flex" }}>
            <PulseDot tone={look.tone} pulsing={health === "checking"} size="xs" />
          </Box>
        </Box>
        {!collapsed && (
          <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
            Agent · {look.label}
          </Typography>
        )}
      </ButtonBase>
    </Tooltip>
  );
}
