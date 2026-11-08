"use client";

import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { hasGoals } from "../../pilot-status";
import { usePilotState } from "../../use-pilot-state";
import { SideSection } from "./side-section";

export function GoalsSummary(): ReactElement {
  const state = usePilotState();
  return (
    <SideSection
      title="Goals"
      action={
        <LinkButton size="small" href="/pilot/goals">
          Edit
        </LinkButton>
      }
    >
      {hasGoals(state) && (
        <Typography
          variant="body2"
          title={state.goals}
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-line",
          }}
        >
          {state.goals}
        </Typography>
      )}
      {!hasGoals(state) && (
        <Typography variant="body2Muted">
          Not written yet. I build my searches from them.
        </Typography>
      )}
    </SideSection>
  );
}
