"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { OutreachBoard } from "@/components/features/outreach";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { useSseChannel } from "@/lib/sse/client";
import { CampaignHeaderCard } from "./detail/header-card";
import { CampaignJobsPanel } from "./detail/jobs-panel";
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
      onMessage: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
      },
      on: {
        "outreach-update": () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.outreach(campaignId) });
        },
      },
    },
  );

  if (detail.isLoading || !detail.data) {
    return <LinearProgress />;
  }

  const campaign = detail.data;

  if (campaign.source === "outreach") {
    return (
      <Stack spacing={3}>
        <CampaignHeaderCard campaign={campaign} />
        <OutreachBoard
          campaignId={campaignId}
          status={campaign.status}
          summary={campaign.summary}
          config={campaign.config.outreach}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <CampaignHeaderCard campaign={campaign} />
      <CampaignSummaryTiles campaign={campaign} />
      <CampaignReasonBreakdown campaign={campaign} />
      <CampaignJobsPanel campaign={campaign} />
    </Stack>
  );
}
