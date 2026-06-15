"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { useSseChannel } from "@/lib/sse/client";
import { PipelineView } from "./pipeline-view";
import { CampaignsRail } from "./rail/campaigns-rail";
import { PipelineScopeBanner } from "./rail/scope-banner";

/**
 * Pairs the Campaigns rail with the stage board and owns the single SSE
 * subscription for the page — invalidating both the pipeline columns and the
 * campaigns list so the board and the rail stay in sync from one connection.
 */
export function PipelineWorkspace(): ReactElement {
  const queryClient = useQueryClient();

  const invalidateCampaigns = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
  };
  useSseChannel(pipelineChannel, null, {
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
    on: {
      "campaign.updated": invalidateCampaigns,
      "campaign.completed": invalidateCampaigns,
      "campaign.deleted": invalidateCampaigns,
    },
  });

  return (
    <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
      <CampaignsRail />
      <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <PipelineScopeBanner />
        <PipelineView />
      </Stack>
    </Stack>
  );
}
