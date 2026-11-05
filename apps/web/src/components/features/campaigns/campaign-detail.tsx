"use client";

import type { ReactElement } from "react";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { campaignQueries } from "@/api/queries";
import { NetworkingBoard, NetworkingMessagesTable } from "@/components/features/networking";
import { DetailLoadFailure, DetailSkeleton } from "@/components/ui/feedback";
import { PageHeader, SectionCard } from "@/components/ui/layout";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { CampaignHeaderCard } from "./detail/header-card";
import { CampaignJobsPanel } from "./detail/jobs-panel";
import { CampaignReasonBreakdown } from "./detail/reason-breakdown";
import { CampaignSummaryTiles } from "./detail/summary-tiles";

interface CampaignDetailProps {
  campaignId: string;
}

export function CampaignDetail(props: CampaignDetailProps): ReactElement {
  const { campaignId } = props;
  const detail = useQuery(campaignQueries.detail(campaignId));

  const detailKey = campaignQueries.detail(campaignId).queryKey;
  const jobKeys = [
    campaignQueries.jobsKey(campaignId),
    campaignQueries.reasons(campaignId).queryKey,
    detailKey,
  ];
  // Per event type: a scoring pass emits a `job-update` per job, and `campaigns.all` refetches all.
  useLiveInvalidation(
    campaignChannel,
    { campaignId },
    {
      on: {
        progress: [detailKey],
        status: [detailKey],
        "job-update": jobKeys,
        "networking-update": [campaignQueries.networkingKey(campaignId)],
      },
      onReconnect: [...jobKeys, campaignQueries.networkingKey(campaignId)],
    },
  );

  const campaign = detail.data;

  if (detail.isPending) {
    return <DetailSkeleton />;
  }

  if (!campaign) {
    return (
      <DetailLoadFailure
        noun="campaign"
        error={detail.error}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  // The title is the campaign's own query, so it lives here and follows live updates.
  const header = (
    <PageHeader
      eyebrow="Campaign"
      title={campaign.query}
      backHref="/workspace"
      backLabel="Workspace"
    />
  );

  if (campaign.summary.kind === "networking") {
    return (
      <Stack spacing={3}>
        {header}
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
      {header}
      <CampaignHeaderCard campaign={campaign} />
      <CampaignSummaryTiles campaign={campaign} />
      <CampaignReasonBreakdown campaign={campaign} />
      <CampaignJobsPanel campaign={campaign} />
      {/* The pilot drafts warm intros against job campaigns, which have no board of their own. */}
      {campaign.summary.networkingCount > 0 && <CampaignOutreach campaignId={campaignId} />}
    </Stack>
  );
}

/** Its own component so the drafts are fetched only by the campaigns that have any. */
function CampaignOutreach(props: CampaignDetailProps): ReactElement {
  const { campaignId } = props;
  const messages = useQuery(campaignQueries.networking(campaignId));

  return (
    <SectionCard title="Outreach" description="Warm intros drafted for these roles.">
      <NetworkingMessagesTable messages={messages.data?.items ?? []} loading={messages.isLoading} />
    </SectionCard>
  );
}
