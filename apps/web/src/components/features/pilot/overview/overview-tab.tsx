"use client";

import type { ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { useTerminalHealth } from "../../agent-dock/use-terminal-health";
import { NeedsAttention } from "../attention/needs-attention";
import { usePilotControls } from "../use-pilot-controls";
import { AgendaPreview } from "./agenda-preview";
import { OrchestrationPanel } from "./orchestration-panel";
import { OverviewSkeleton } from "./overview-skeleton";
import { PilotStatusProvider } from "./pilot-status-context";
import { RecentActivity } from "./recent-activity";
import { PilotSetupChecklist } from "./setup-checklist";
import { StatusHero } from "./status-hero";

export function OverviewTab(): ReactElement {
  // Controls + health are hoisted so the hero and the checklist share one host poll.
  const controls = usePilotControls();
  const { health, status } = useTerminalHealth(controls.busy);
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });

  if (stateQuery.isLoading || !stateQuery.data) {
    return <OverviewSkeleton />;
  }

  const state = stateQuery.data;

  // On xs, Needs-attention hoists above the hero so it's reachable one-handed;
  // md keeps DOM order. useFlexGap makes `order` reflow cleanly.
  return (
    <PilotStatusProvider state={state} controls={controls} health={health} hostStatus={status}>
      <Stack spacing={3} useFlexGap>
        <PilotSetupChecklist />
        <Box sx={{ order: { xs: 2, md: 0 } }}>
          <StatusHero />
        </Box>
        <Box sx={{ order: { xs: 3, md: 0 } }}>
          <OrchestrationPanel />
        </Box>
        <Box sx={{ order: { xs: 1, md: 0 } }}>
          <NeedsAttention />
        </Box>
        <Box sx={{ order: { xs: 4, md: 0 } }}>
          <AgendaPreview />
        </Box>
        <Box sx={{ order: { xs: 5, md: 0 } }}>
          <RecentActivity />
        </Box>
      </Stack>
    </PilotStatusProvider>
  );
}
