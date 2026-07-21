"use client";

import type { ReactElement, ReactNode } from "react";
import { Stop } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { invalidations } from "@/api/query-keys";
import type { CampaignDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { PulseDot } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";

/** Folds a campaign's summary into a single progress reading, type-aware. */
function progress(campaign: CampaignDto): { value: number; label: string } {
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
  const campaigns = useApiQuery(campaignQueries.list());
  const running = (campaigns.data?.items ?? []).filter((c) => c.status === "in_progress");

  if (running.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Now running">
      <Stack spacing={1.5}>
        {running.map((c) => (
          <RunningRow key={c.campaignId} campaign={c} />
        ))}
      </Stack>
    </SectionCard>
  );
}

function RunningRow(props: { campaign: CampaignDto }): ReactElement {
  const { campaign } = props;
  const p = progress(campaign);

  const pause = useApiMutation<{ campaignId: string; status: string }, void>(
    () =>
      api.campaigns({ id: campaign.campaignId }).status.post({ status: "paused", actor: "user" }),
    {
      successMessage: "Campaign paused",
      invalidate: invalidations.campaign,
    },
  );

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <PulseDot tone="green" pulsing />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="body2Strong" noWrap>
            {campaign.query}
          </Typography>
          <Typography variant="captionMuted" noWrap>
            {campaign.source} · {p.label}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, p.value)}
          sx={{ mt: 0.75, borderRadius: 1 }}
        />
      </Box>
      <LinkButton
        size="small"
        variant="text"
        href={`/campaigns/${encodeURIComponent(campaign.campaignId)}` as Route}
      >
        Open
      </LinkButton>
      <Button
        size="small"
        variant="outlined"
        color="warning"
        startIcon={<Stop fontSize="sm" />}
        disabled={pause.isPending}
        onClick={() => pause.mutate()}
      >
        Stop
      </Button>
    </Stack>
  );
}
