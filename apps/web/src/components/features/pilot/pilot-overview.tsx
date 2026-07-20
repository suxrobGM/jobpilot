"use client";

import type { ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { useTerminalHealth } from "../agent-dock/use-terminal-health";
import { NeedsAttention } from "./attention/needs-attention";
import { AgendaPreview } from "./overview/agenda-preview";
import { OrchestrationPanel } from "./overview/orchestration-panel";
import { RecentActivity } from "./overview/recent-activity";
import { PilotSetupChecklist } from "./overview/setup-checklist";
import { OverviewSkeleton } from "./overview/skeleton";
import { StatusHero } from "./overview/status-hero";
import { usePilotToggle } from "./use-pilot-toggle";

export function PilotOverview(): ReactElement {
  // Toggle + health are hoisted so the hero and the checklist share one host poll.
  const toggle = usePilotToggle();
  const { health, status } = useTerminalHealth(toggle.busy);
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
    <Stack spacing={3} useFlexGap>
      <PilotSetupChecklist state={state} toggle={toggle} health={health} />
      <Box sx={{ order: { xs: 2, md: 0 } }}>
        <StatusHero state={state} toggle={toggle} health={health} hostStatus={status} />
      </Box>
      <Box sx={{ order: { xs: 3, md: 0 } }}>
        <OrchestrationPanel state={state} health={health} hostStatus={status} />
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
  );
}
