"use client";

import type { ReactElement } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Grid, LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";
import { BudgetTile } from "./budget-tile";
import { EscalationList } from "./escalation-list";
import { JournalFeed } from "./journal-feed";
import { MandateEditor } from "./mandate-editor";
import { PilotStatusCard } from "./pilot-status-card";

export function PilotView(): ReactElement {
  const queryClient = useQueryClient();
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });

  useSseChannel(pilotChannel, null, {
    on: {
      "state.changed": () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() });
      },
    },
  });

  if (stateQuery.isLoading || !stateQuery.data) {
    return <LinearProgress />;
  }

  const state = stateQuery.data;

  return (
    <Stack spacing={3}>
      <Grid container spacing={3} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <PilotStatusCard state={state} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <BudgetTile state={state} />
        </Grid>
      </Grid>
      <EscalationList />
      <MandateEditor state={state} />
      <JournalFeed />
    </Stack>
  );
}
