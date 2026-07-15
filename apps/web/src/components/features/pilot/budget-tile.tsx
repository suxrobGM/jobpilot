"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { analyticsQueries } from "@/api/queries";
import { StatCard } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";

interface BudgetTileProps {
  state: PilotState;
}

/** UTC-midnight of the current day, matching the analytics per-day bucket keys. */
function utcTodayKey(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function BudgetTile(props: BudgetTileProps): ReactElement {
  const { state } = props;
  const { dailyApplyCap, minScore } = state.mandateConfig;

  // Today's applied count is not on the pilot state (agenda is the agent's endpoint,
  // and polling it mutates lease/escalation expiry), so derive it from analytics.
  const analytics = useApiQuery(analyticsQueries.stats());
  const todayKey = utcTodayKey();
  const appliedToday =
    analytics.data?.perDay.find((p) => new Date(p.date).getTime() === todayKey)?.count ?? 0;

  const capReached = dailyApplyCap > 0 && appliedToday >= dailyApplyCap;
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
