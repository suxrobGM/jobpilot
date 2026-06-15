"use client";

import type { ReactElement } from "react";
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { CampaignDetailDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { CAMPAIGN_STATUS_COLOR, CAMPAIGN_STATUS_LABEL } from "../campaign-status";
import { CampaignActionsBar } from "./actions-bar";
import { CampaignIdentityBanner } from "./identity-banner";

interface CampaignHeaderCardProps {
  campaign: CampaignDetailDto;
}

/** Consolidated campaign header: status, query, config + identity, and actions in one card. */
export function CampaignHeaderCard(props: CampaignHeaderCardProps): ReactElement {
  const { campaign } = props;
  const cfg = campaign.config;
  const isAutoApply = campaign.source === "auto-apply";

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { xs: "stretch", sm: "flex-start" }, justifyContent: "space-between" }}
        >
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
            >
              <Chip
                size="small"
                label={CAMPAIGN_STATUS_LABEL[campaign.status]}
                color={CAMPAIGN_STATUS_COLOR[campaign.status]}
                variant="outlined"
              />
              <Typography
                variant="body1"
                sx={{ fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}
              >
                {campaign.query}
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="body2Muted">
                {campaign.source} · Started {formatRelativeTime(campaign.startedAt)} ago
              </Typography>
              {cfg.board && <Chip size="small" label={`Board: ${cfg.board}`} variant="outlined" />}
              {!isAutoApply && typeof cfg.maxJobs === "number" && (
                <Chip size="small" label={`Jobs: ${cfg.maxJobs}`} variant="outlined" />
              )}
              {isAutoApply && typeof cfg.minScore === "number" && (
                <Chip size="small" label={`Min score: ${cfg.minScore}`} variant="outlined" />
              )}
              {isAutoApply && (
                <Chip
                  size="small"
                  label={`Max apps: ${cfg.maxApplications ?? "∞"}`}
                  variant="outlined"
                />
              )}
            </Stack>

            <CampaignIdentityBanner />

            {campaign.status === "paused" && (
              <Typography variant="captionMuted">Paused — resume to continue.</Typography>
            )}

            {campaign.status === "interrupted" && (
              <Typography variant="captionMuted">
                Interrupted — the agent stopped before finishing. Resume to continue, or mark it
                done.
              </Typography>
            )}
          </Stack>

          <CampaignActionsBar campaign={campaign} />
        </Stack>
      </CardContent>
    </Card>
  );
}
