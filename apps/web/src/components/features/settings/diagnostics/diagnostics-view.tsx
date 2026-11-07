"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { CycleCost } from "./cycle-cost";
import { JournalFeed } from "./journal-feed";
import { OrchestrationPanel } from "./orchestration-panel";

/** How the pilot works under the hood: the loop, its agents, token cost, and the raw journal. */
export function DiagnosticsView(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const state = stateQuery.data;
  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[220, 180, 320]} />;
  }
  if (!state) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }
  return (
    <Stack spacing={3}>
      <OrchestrationPanel state={state} />
      <CycleCost />
      <JournalFeed />
    </Stack>
  );
}
