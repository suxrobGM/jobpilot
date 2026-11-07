"use client";

import { type ReactElement, useState } from "react";
import { Button, Typography } from "@mui/material";
import { usePilotState } from "../../use-pilot-state";
import { RulesDialog } from "./rules-dialog";
import { SideSection } from "./side-section";

export function RulesSummary(): ReactElement {
  const state = usePilotState();
  const [editing, setEditing] = useState(false);
  const { dailyApplyCap, minScore, dealBreakers } = state.config;

  return (
    <SideSection
      title="Rules"
      action={
        <Button size="small" onClick={() => setEditing(true)}>
          Edit
        </Button>
      }
    >
      <Typography variant="body2">{`${dailyApplyCap} a day · score ${minScore}+`}</Typography>
      {dealBreakers.length > 0 && (
        <Typography variant="body2Muted">{`Skip: ${dealBreakers.join(", ")}`}</Typography>
      )}
      <RulesDialog open={editing} onClose={() => setEditing(false)} />
    </SideSection>
  );
}
