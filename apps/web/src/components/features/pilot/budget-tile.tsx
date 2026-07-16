"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { StatCard } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";

interface BudgetTileProps {
  state: PilotState;
}

export function BudgetTile(props: BudgetTileProps): ReactElement {
  const { state } = props;
  const { dailyApplyCap, minScore } = state.instructionsConfig;
  const { appliedToday, capReached } = state;

  const progress = dailyApplyCap > 0 ? Math.min(100, (appliedToday / dailyApplyCap) * 100) : 0;

  return (
    <SectionCard title="Today's budget">
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Typography variant="body2Muted">Applied today</Typography>
            <Typography variant="body2" color={capReached ? "error.main" : "text.primary"}>
              {appliedToday} / {dailyApplyCap}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={capReached ? "error" : "primary"}
          />
        </Stack>
        <Grid container spacing={2}>
          <Grid size={6}>
            <StatCard label="Min score" value={minScore} />
          </Grid>
          <Grid size={6}>
            <StatCard label="Daily cap" value={dailyApplyCap} />
          </Grid>
        </Grid>
      </Stack>
    </SectionCard>
  );
}
