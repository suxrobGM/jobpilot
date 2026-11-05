"use client";

import type { ReactElement, ReactNode } from "react";
import { Stop } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries, OPTIONS_PAGE } from "@/api/queries";
import { invalidations } from "@/api/query-keys";
import type { CampaignDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { statusLabel } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { radii } from "@/theme";
import { campaignHref } from "@/utils/routes";

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
  const campaigns = useApiQuery(campaignQueries.list({ ...OPTIONS_PAGE, status: ["in_progress"] }));
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

function RunningRow(props: { campaign: CampaignDto }): ReactElement {
  const { campaign } = props;
  const p = progress(campaign);

  const pause = useApiMutation(
    () => api.campaigns({ id: campaign.id }).status.post({ status: "paused", actor: "user" }),
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
