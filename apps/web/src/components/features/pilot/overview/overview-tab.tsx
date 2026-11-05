"use client";

import type { ReactElement } from "react";
import { Grid, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { NeedsAttention } from "../attention/needs-attention";
import { JobAlertsPanel } from "../job-alerts/job-alerts-panel";
import { OrchestrationPanel } from "./orchestration-panel";
import { RecentActivity } from "./recent-activity";
import { PilotSetupChecklist } from "./setup-checklist";
import { StatusBar } from "./status-bar";
import { TaskListPreview } from "./task-list-preview";
import { TodayPanel } from "./today-panel";

export function OverviewTab(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const state = stateQuery.data;
  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[96, 56, 220, 180]} />;
  }
  if (!state) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }

  return (
    <Stack spacing={3}>
      <PilotSetupChecklist state={state} />
      <StatusBar state={state} />
      <JobAlertsPanel />
      <NeedsAttention />
      <OrchestrationPanel state={state} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <TodayPanel state={state} />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <TaskListPreview running={state.running} />
        </Grid>
      </Grid>
      <RecentActivity />
    </Stack>
  );
}
