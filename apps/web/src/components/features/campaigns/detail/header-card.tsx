"use client";

import type { ReactElement } from "react";
import type { CampaignActor } from "@jobpilot/contracts/campaign";
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { CampaignDetailDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { CampaignStatusChip } from "../campaign-status-chip";
import { PilotBadge } from "../pilot-badge";
import { CampaignActionsBar } from "./actions-bar";
import { CampaignIdentityBanner } from "./identity-banner";

/** Actor names as shown in status attributions ("Paused by you / the agent / the pilot"). */
const CAMPAIGN_ACTOR_LABEL: Record<CampaignActor, string> = {
  user: "you",
  agent: "the agent",
  pilot: "the pilot",
};

interface CampaignHeaderCardProps {
  campaign: CampaignDetailDto;
}

/** Consolidated campaign header: status, query, config + identity, and actions in one card. */
export function CampaignHeaderCard(props: CampaignHeaderCardProps): ReactElement {
  const { campaign } = props;
  const cfg = campaign.config;
  const isAutoApply = campaign.source === "auto-apply";
  const pausedBy = campaign.statusActor
    ? `Paused by ${CAMPAIGN_ACTOR_LABEL[campaign.statusActor]}`
    : "Paused";
  const pausedReason = campaign.statusReason ? ` - ${campaign.statusReason}` : "";

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
              <CampaignStatusChip status={campaign.status} />
              <Typography variant="body1Strong" sx={{ minWidth: 0, wordBreak: "break-word" }}>
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
              <PilotBadge createdBy={campaign.createdBy} />
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
              <Typography variant="captionMuted">
                {`${pausedBy}${pausedReason} · resume to continue.`}
              </Typography>
            )}
          </Stack>

          <CampaignActionsBar campaign={campaign} />
        </Stack>
      </CardContent>
    </Card>
  );
}
