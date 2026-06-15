"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDetailDto, CampaignJobDto, UpworkProposalDto } from "@/api/types";
import { OutreachBoard } from "@/components/features/outreach";
import { campaignChannel } from "@/lib/sse/channels/campaign";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";
import { UPWORK_DOMAIN } from "./composer/form-config";
import { CampaignHeaderCard } from "./detail/header-card";
import { CampaignJobsPanel } from "./detail/jobs-panel";
import { CampaignReasonBreakdown } from "./detail/reason-breakdown";
import { CampaignSummaryTiles } from "./detail/summary-tiles";

interface CampaignDetailProps {
  campaignId: string;
}

export function CampaignDetail(props: CampaignDetailProps): ReactElement {
  const { campaignId } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const agent = useAgent();
  const toast = useToast();

  const detail = useApiQuery<CampaignDetailDto>(queryKeys.campaigns.detail(campaignId), () =>
    apiClient.get<CampaignDetailDto>(`/api/campaigns/${encodeURIComponent(campaignId)}`),
  );

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
  const isAutoApply = campaign.source === "auto-apply";
  const isUpwork = campaign.config.board === UPWORK_DOMAIN;

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

  // Auto-apply campaigns apply on their own; on other campaigns (e.g. search results) the
  // user dispatches a job to the single-job apply flow by its URL.
  const applyJob = (job: CampaignJobDto): void => {
    if (!isAutoApply) {
      return;
    }
    void agent.injectSkill("apply", job.url);
  };

  // Upwork recommendations are recommend-only: seed a proposal draft from the
  // recommendation, then hand off to the upwork-proposal skill to write it.
  const draftProposal = async (job: CampaignJobDto): Promise<void> => {
    const res = await apiClient.post<UpworkProposalDto>("/api/upwork/proposals", {
      jobTitle: job.title,
      clientName: job.company || null,
      jobUrl: job.url,
      jobDescription: job.description ?? "",
      source: "search",
      campaignId: job.campaignId,
      jobKey: job.key,
    });
    if (res.error || !res.data) {
      toast.error(res.error?.message ?? "Could not create the proposal draft");
      return;
    }
    void agent.injectSkill("upwork-proposal", String(res.data.id));
    router.push(`/upwork/${res.data.id}` as Route);
  };

  return (
    <Stack spacing={3}>
      <CampaignHeaderCard campaign={campaign} />
      <CampaignSummaryTiles campaign={campaign} />
      <CampaignReasonBreakdown campaign={campaign} />
      <CampaignJobsPanel
        campaign={campaign}
        onApplyJob={isUpwork ? undefined : applyJob}
        onDraftProposal={isUpwork ? draftProposal : undefined}
        showReason={isUpwork}
      />
    </Stack>
  );
}
