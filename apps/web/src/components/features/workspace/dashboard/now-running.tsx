"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { campaignQueries, FULL_PAGE } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { PauseCampaignButton } from "@/components/features/campaigns/pause-campaign-button";
import { LinkButton } from "@/components/ui/buttons";
import { statusLabel } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { radii } from "@/theme";
import { campaignHref } from "@/utils/routes";

interface CampaignProgress {
  value: number;
  label: string;
}

function getCampaignProgress(campaign: CampaignDto): CampaignProgress {
  const { summary } = campaign;
  if (summary.kind === "networking") {
    const total = Math.max(summary.discovered, 1);
    return {
      value: (summary.sent / total) * 100,
      label: `${summary.sent}/${summary.discovered} sent`,
    };
  }
  const total = Math.max(summary.qualified || summary.totalFound, 1);
  return { value: (summary.applied / total) * 100, label: `${summary.applied}/${total} applied` };
}

/** Live strip of in-progress campaigns. Renders nothing when nothing is running. */
export function NowRunning(): ReactNode {
  const campaigns = useQuery(campaignQueries.list({ ...FULL_PAGE, status: ["in_progress"] }));
  const running = campaigns.data?.items ?? [];

  if (running.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Now running">
      <Stack spacing={1.5}>
        {running.map((campaign) => (
          <RunningRow key={campaign.id} campaign={campaign} />
        ))}
      </Stack>
    </SectionCard>
  );
}

interface RunningRowProps {
  campaign: CampaignDto;
}

function RunningRow(props: RunningRowProps): ReactElement {
  const { campaign } = props;
  const progress = getCampaignProgress(campaign);

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <PulseDot tone="green" pulsing />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="body2Strong" noWrap>
            {campaign.query}
          </Typography>
          <Typography variant="captionMuted" noWrap>
            {statusLabel("source", campaign.source)} · {progress.label}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, progress.value)}
          sx={{ mt: 0.75, borderRadius: radii.xs }}
        />
      </Box>
      <LinkButton size="small" variant="text" href={campaignHref(campaign.id)}>
        Open
      </LinkButton>
      <PauseCampaignButton campaignId={campaign.id} size="small" />
    </Stack>
  );
}
