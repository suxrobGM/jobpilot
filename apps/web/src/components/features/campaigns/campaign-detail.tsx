"use client";

import type { ReactElement } from "react";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { Stack } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isNotFound } from "@/api/error";
import { campaignQueries } from "@/api/queries";
import { NetworkingBoard, NetworkingMessagesTable } from "@/components/features/networking";
import { DetailSkeleton, EmptyState, QueryError } from "@/components/ui/feedback";
import { PageHeader, SectionCard } from "@/components/ui/layout";
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

  const detail = useQuery(campaignQueries.detail(campaignId));

  const invalidate = (key: readonly unknown[]): void => {
    queryClient.invalidateQueries({ queryKey: key });
  };
  const invalidateDetail = (): void => invalidate(campaignQueries.detail(campaignId).queryKey);

  useSseChannel(
    campaignChannel,
    { campaignId },
    {
      // Scoped per event type: a scoring pass emits one `job-update` per job, so a blanket
      // `campaigns.all` here would refetch every cached list, page and aggregate on each one.
      on: {
        progress: invalidateDetail,
        status: invalidateDetail,
        "job-update": () => {
          invalidate(campaignQueries.jobsOf(campaignId));
          invalidate(campaignQueries.reasons(campaignId).queryKey);
          invalidateDetail();
        },
        "networking-update": () => invalidate(campaignQueries.networkingOf(campaignId)),
      },
    },
  );

  const campaign = detail.data;

  if (detail.isPending) {
    return <DetailSkeleton />;
  }

  if (!campaign) {
    return isNotFound(detail.error) ? (
      <EmptyState
        title="Campaign not found"
        description="It may have been deleted, or the link is incorrect."
      />
    ) : (
      <QueryError title="Couldn't load this campaign." onRetry={() => void detail.refetch()} />
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
