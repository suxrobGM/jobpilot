"use client";

import type { ReactElement } from "react";
import { ButtonBase, Tooltip } from "@mui/material";
import { RailLabel, railTile } from "@/components/layout/rail-tile";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";
import { useAgentActivity } from "./use-agent-activity";

/** The rail's Agent entry: opens and closes the agent drawer; the tooltip says what it's doing. */
export function AgentButton(): ReactElement {
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { orb, label } = useAgentActivity();
  const text = orb === "working" ? label : `Agent · ${label}`;

  return (
    <Tooltip title={text} placement="right" arrow>
      <ButtonBase
        aria-label={drawerOpen ? "Close agent" : `Open agent: ${text}`}
        aria-pressed={drawerOpen}
        onClick={drawerOpen ? closeDrawer : openDrawer}
        sx={railTile(drawerOpen)}
      >
        <AgentOrb state={orb} size="lg" />
        <RailLabel>Agent</RailLabel>
      </ButtonBase>
    </Tooltip>
  );
}
