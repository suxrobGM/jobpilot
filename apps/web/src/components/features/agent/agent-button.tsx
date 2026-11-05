"use client";

import type { ReactElement } from "react";
import { Box, ButtonBase, Tooltip } from "@mui/material";
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

/** The rail's foot: opens and closes the agent drawer, with the host's health as a dot. */
export function AgentButton(): ReactElement {
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { health } = useTerminalHealth();
  const look = HEALTH_LOOK[health];

  return (
    <Tooltip title={`Agent · ${look.label}`} placement="right" arrow>
      <ButtonBase
        aria-label={drawerOpen ? "Close agent" : "Open agent"}
        aria-pressed={drawerOpen}
        onClick={drawerOpen ? closeDrawer : openDrawer}
        sx={(theme) => ({
          position: "relative",
          borderRadius: "50%",
          "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
        })}
      >
        <AgentOrb size="xxl" />
        <Box sx={{ position: "absolute", right: 0, bottom: 0, display: "flex" }}>
          <PulseDot tone={look.tone} pulsing={health === "checking"} size="xs" />
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}
