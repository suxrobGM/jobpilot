"use client";

import type { ReactElement } from "react";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { NetworkingBoard } from "@/components/features/networking";
import { useSseChannel } from "@/lib/sse/client";
import { CampaignHeaderCard } from "./detail/header-card";
import { CampaignJobsPanel } from "./detail/jobs-panel";
import { PipelineFunnel } from "./detail/pipeline-funnel";
import { CampaignReasonBreakdown } from "./detail/reason-breakdown";
import { CampaignSummaryTiles } from "./detail/summary-tiles";

interface CampaignDetailProps {
  campaignId: string;
}

export function CampaignDetail(props: CampaignDetailProps): ReactElement {
  const { campaignId } = props;
  const queryClient = useQueryClient();

  const detail = useApiQuery(campaignQueries.detail(campaignId));

  useSseChannel(
    campaignChannel,
    { campaignId },
    {
      // Scoped per event type: a scoring pass emits one `job-update` per job, so a blanket
      // `campaigns.all` here would refetch every cached list, page and aggregate on each one.
      on: {
        progress: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
        "job-update": () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.jobs(campaignId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.reasons(campaignId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
        status: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
        "networking-update": () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.networking(campaignId) });
        },
      },
    },
  );

  if (detail.isLoading || !detail.data) {
    return <LinearProgress />;
  }

  const campaign = detail.data;

  if (campaign.summary.kind === "networking") {
    return (
      <Stack spacing={3}>
        <CampaignHeaderCard campaign={campaign} />
        <NetworkingBoard
          campaignId={campaignId}
          status={campaign.status}
          summary={campaign.summary}
          config={campaign.config.networking}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <CampaignHeaderCard campaign={campaign} />
      <CampaignSummaryTiles campaign={campaign} />
      <PipelineFunnel campaign={campaign} />
      <CampaignReasonBreakdown campaign={campaign} />
      <CampaignJobsPanel campaign={campaign} />
    </Stack>
  );
}
