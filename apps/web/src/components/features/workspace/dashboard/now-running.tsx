"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { campaignQueries, OPTIONS_PAGE } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { PauseCampaignButton } from "@/components/features/campaigns/pause-campaign-button";
import { LinkButton } from "@/components/ui/buttons";
import { statusLabel } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { radii } from "@/theme";
import { campaignHref } from "@/utils/routes";

/** Folds a campaign's summary into a single progress reading, type-aware. */
interface CampaignProgress {
  value: number;
  label: string;
}

function progress(campaign: CampaignDto): CampaignProgress {
  const s = campaign.summary;
  if (s.kind === "networking") {
    const total = Math.max(s.discovered, 1);
    return { value: (s.sent / total) * 100, label: `${s.sent}/${s.discovered} sent` };
  }
  const total = Math.max(s.qualified || s.totalFound, 1);
  return { value: (s.applied / total) * 100, label: `${s.applied}/${total} applied` };
}

/** Live strip of in-progress campaigns. Renders nothing when nothing is running. */
export function NowRunning(): ReactNode {
  const campaigns = useQuery(campaignQueries.list({ ...OPTIONS_PAGE, status: ["in_progress"] }));
  const running = campaigns.data?.items ?? [];

  if (running.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Now running">
      <Stack spacing={1.5}>
        {running.map((c) => (
          <RunningRow key={c.id} campaign={c} />
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
  const p = progress(campaign);

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <PulseDot tone="green" pulsing />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="body2Strong" noWrap>
            {campaign.query}
          </Typography>
          <Typography variant="captionMuted" noWrap>
            {statusLabel("source", campaign.source)} · {p.label}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, p.value)}
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
