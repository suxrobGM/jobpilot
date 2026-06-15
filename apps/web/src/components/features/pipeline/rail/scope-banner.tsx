"use client";

import type { ReactNode } from "react";
import { Close } from "@mui/icons-material";
import { Button, Card, CardActions, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto } from "@/api/types";
import {
  CAMPAIGN_STATUS_COLOR,
  CAMPAIGN_STATUS_LABEL,
} from "@/components/features/campaigns/campaign-status";
import { LinkButton } from "@/components/ui/buttons";
import { usePipelineFilters } from "../hooks/use-pipeline-filters";

/**
 * Banner shown above the board when it is scoped to a campaign. Reads the campaign from
 * the (cached) campaigns list shared with the rail — no extra fetch. Renders nothing
 * when no campaign is scoped.
 */
export function PipelineScopeBanner(): ReactNode {
  const { campaignId, setCampaignId } = usePipelineFilters();
  const campaigns = useApiQuery<CampaignDto[]>(queryKeys.campaigns.list(), () =>
    apiClient.get<CampaignDto[]>("/api/campaigns"),
  );

  if (!campaignId) {
    return null;
  }

  const campaign = campaigns.data?.find((r) => r.campaignId === campaignId) ?? null;

  return (
    <Card sx={{ mx: 2.5, mt: 2, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
      <CardContent sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
        >
          <Typography variant="overlineMuted">Scoped to campaign</Typography>
          {campaign && (
            <Chip
              size="small"
              label={CAMPAIGN_STATUS_LABEL[campaign.status]}
              color={CAMPAIGN_STATUS_COLOR[campaign.status]}
              variant="outlined"
            />
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
            {campaign?.query ?? campaignId}
          </Typography>
          {campaign && (
            <Typography variant="captionMuted">
              {campaign.summary.applied} applied · {campaign.summary.failed} failed ·{" "}
              {campaign.summary.skipped} skipped
            </Typography>
          )}
        </Stack>
      </CardContent>
      <CardActions>
        <LinkButton
          size="small"
          variant="text"
          href={`/campaigns/${encodeURIComponent(campaignId)}` as Route}
        >
          View details
        </LinkButton>
        <Button
          size="small"
          variant="text"
          startIcon={<Close fontSize="sm" />}
          onClick={() => setCampaignId(null)}
        >
          Clear scope
        </Button>
      </CardActions>
    </Card>
  );
}
