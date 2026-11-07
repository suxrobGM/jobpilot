"use client";

import type { ReactElement } from "react";
import { ButtonBase, Tooltip } from "@mui/material";
import { RailLabel, railTile } from "@/components/layout/rail-tile";
import { AgentOrb } from "./agent-orb";
import { useAgentToggle } from "./use-agent-toggle";

/** The rail's Agent entry: opens and closes the agent drawer; the tooltip says what it's doing. */
export function AgentButton(): ReactElement {
  const { orb, text, open, buttonProps } = useAgentToggle();

  return (
    <Tooltip title={text} placement="right" arrow>
      <ButtonBase {...buttonProps} sx={railTile(open)}>
        <AgentOrb state={orb} size="lg" />
        <RailLabel>Agent</RailLabel>
      </ButtonBase>
    </Tooltip>
  );
}
