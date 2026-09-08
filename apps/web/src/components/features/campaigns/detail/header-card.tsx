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

function pausedLine(campaign: CampaignDetailDto): string {
  const by = campaign.statusActor ? ` by ${CAMPAIGN_ACTOR_LABEL[campaign.statusActor]}` : "";
  const reason = campaign.statusReason ? ` - ${campaign.statusReason}` : "";
  return `Paused${by}${reason} · resume to continue.`;
}

interface CampaignHeaderCardProps {
  campaign: CampaignDetailDto;
}

/** Consolidated campaign header: status, query, config + identity, and actions in one card. */
export function CampaignHeaderCard(props: CampaignHeaderCardProps): ReactElement {
  const { campaign } = props;
  const cfg = campaign.config;
  const isAutoApply = campaign.source === "auto_apply";

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
              <Typography variant="captionMuted">{pausedLine(campaign)}</Typography>
            )}
          </Stack>

          <CampaignActionsBar campaign={campaign} />
        </Stack>
      </CardContent>
    </Card>
  );
}
