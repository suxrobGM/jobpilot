"use client";

import type { ReactElement } from "react";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { NetworkingBoard, NetworkingMessagesTable } from "@/components/features/networking";
import { SectionCard } from "@/components/ui/layout";
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

  const invalidate = (key: readonly unknown[]): void => {
    queryClient.invalidateQueries({ queryKey: key });
  };
  const invalidateDetail = (): void => invalidate(queryKeys.campaigns.detail(campaignId));

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
          invalidate(queryKeys.campaigns.jobs(campaignId));
          invalidate(queryKeys.campaigns.reasons(campaignId));
          invalidateDetail();
        },
        "networking-update": () => invalidate(queryKeys.campaigns.networking(campaignId)),
      },
    },
  );

  const campaign = detail.data;

  if (detail.isLoading) {
    return <LinearProgress />;
  }

  // Silently spinning forever is the failure mode this rules out.
  if (!campaign) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="body2Muted">Couldn't load this campaign.</Typography>
        <Button variant="text" size="small" onClick={() => void detail.refetch()}>
          Retry
        </Button>
      </Stack>
    );
  }

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
  const messages = useApiQuery(campaignQueries.networking(campaignId));

  return (
    <SectionCard title="Outreach" description="Warm intros drafted for these roles.">
      <NetworkingMessagesTable messages={messages.data?.items ?? []} loading={messages.isLoading} />
    </SectionCard>
  );
}
