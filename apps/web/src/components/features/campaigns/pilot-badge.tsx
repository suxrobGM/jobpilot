"use client";

import type { ReactNode } from "react";
import type { Actor } from "@jobpilot/contracts/campaign";
import { Chip, Tooltip } from "@mui/material";

interface PilotBadgeProps {
  createdBy: Actor;
}

/** Marks a campaign the pilot created; renders nothing for user- or agent-created ones. */
export function PilotBadge(props: PilotBadgeProps): ReactNode {
  if (props.createdBy !== "pilot") {
    return null;
  }
  return (
    <Tooltip
      title="The Pilot started this one on its own, from your instructions."
      enterDelay={400}
    >
      <Chip label="Pilot" color="info" variant="outlined" />
    </Tooltip>
  );
}
