"use client";

import type { ReactElement } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Box, Grid, LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";
import { BudgetTile } from "./budget-tile";
import { InstructionsEditor } from "./instructions-editor";
import { JournalFeed } from "./journal-feed";
import { PilotStatusCard } from "./pilot-status-card";
import { PromotionList } from "./promotion-list";
import { PushSettings } from "./push-settings";
import { QuestionList } from "./question-list";

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

  // On xs, open questions hoist above the status cards so they're reachable one-handed;
  // md keeps DOM order (status/budget, then questions). useFlexGap makes `order` reflow cleanly.
  return (
    <Stack spacing={3} useFlexGap>
      <Grid container spacing={3} sx={{ alignItems: "stretch", order: { xs: 2, md: 0 } }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <PilotStatusCard state={state} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <BudgetTile state={state} />
        </Grid>
      </Grid>
      <Box sx={{ order: { xs: 1, md: 0 } }}>
        <QuestionList />
      </Box>
      <Box sx={{ order: { xs: 2, md: 0 } }}>
        <PromotionList />
      </Box>
      <Box sx={{ order: { xs: 3, md: 0 } }}>
        <InstructionsEditor state={state} />
      </Box>
      <Box sx={{ order: { xs: 4, md: 0 } }}>
        <PushSettings />
      </Box>
      <Box sx={{ order: { xs: 5, md: 0 } }}>
        <JournalFeed />
      </Box>
    </Stack>
  );
}
