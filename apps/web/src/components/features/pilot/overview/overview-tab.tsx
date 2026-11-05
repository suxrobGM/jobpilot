"use client";

import type { ReactElement } from "react";
import { Grid, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/data";
import { useTerminalHealth } from "../../agent-dock/use-terminal-health";
import { NeedsAttention } from "../attention/needs-attention";
import { JobAlertsPanel } from "../job-alerts/job-alerts-panel";
import { pilotMode } from "../pilot-status";
import { usePilotControls } from "../use-pilot-controls";
import { OrchestrationPanel } from "./orchestration-panel";
import { RecentActivity } from "./recent-activity";
import { PilotSetupChecklist } from "./setup-checklist";
import { StatusBar } from "./status-bar";
import { TaskListPreview } from "./task-list-preview";
import { TodayPanel } from "./today-panel";
import { useNextWake } from "./use-next-wake";

export function OverviewTab(): ReactElement {
  // Owned here so the status bar, checklist and diagram share one host poll and wake timer.
  const controls = usePilotControls();
  const { health, status } = useTerminalHealth(controls.isLoading);
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });
  const nextWakeAt = useNextWake(stateQuery.data ?? null);

  const state = stateQuery.data;
  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[96, 56, 220, 180]} />;
  }
  if (!state) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }

  const pilot = status?.pilot ?? null;
  const mode = pilotMode(state, health, pilot);

  return (
    <Stack spacing={3}>
      <PilotSetupChecklist state={state} health={health} />
      <StatusBar
        state={state}
        controls={controls}
        health={health}
        pilot={pilot}
        mode={mode}
        nextWakeAt={nextWakeAt}
      />
      <JobAlertsPanel />
      <NeedsAttention />
      <OrchestrationPanel state={state} pilot={pilot} mode={mode} nextWakeAt={nextWakeAt} />
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
