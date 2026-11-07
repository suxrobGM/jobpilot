"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Typography } from "@mui/material";
import { RulesDialog } from "./rules-dialog";
import { SideSection } from "./side-section";

interface RulesSummaryProps {
  state: PilotState;
}

export function RulesSummary(props: RulesSummaryProps): ReactElement {
  const { state } = props;
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
      <RulesDialog state={state} open={editing} onClose={() => setEditing(false)} />
    </SideSection>
  );
}
