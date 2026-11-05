"use client";

import type { ReactElement } from "react";
import { Box, Card, CardActionArea, Chip, Stack, Tooltip, Typography } from "@mui/material";
import type { CampaignDto } from "@/api/types";
import { RelativeTime } from "@/components/ui/display";
import { campaignHref } from "@/utils/routes";
import { CampaignStatusChip } from "./campaign-status-chip";
import { PilotBadge } from "./pilot-badge";

interface CampaignRowProps {
  campaign: CampaignDto;
}

/** Networking campaigns track contacts/messages; job campaigns track applications. */
function summaryLine(campaign: CampaignDto): string {
  const s = campaign.summary;
  if (s.kind === "networking") {
    return `${s.discovered} found · ${s.sent} sent · ${s.replied} replied`;
  }
  const tail = s.remaining > 0 ? ` · ${s.remaining} left` : "";
  return `${s.applied} applied · ${s.failed} failed · ${s.skipped} skipped${tail}`;
}

// A high skip count is normal and reads like a fault without this.
function summaryHint(campaign: CampaignDto): string {
  if (campaign.summary.kind === "networking") {
    return "Found: contacts discovered. Sent: messages sent. Replied: contacts who wrote back.";
  }
  return "Applied: submitted. Failed: the application errored. Skipped: below your match score, already applied, or the posting states a requirement you can't meet. Left: still waiting.";
}

export function CampaignRow(props: CampaignRowProps): ReactElement {
  const { campaign } = props;

  return (
    <Card variant="interactive">
      <CardActionArea href={campaignHref(campaign.id)} sx={{ padding: 1.25 }}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <CampaignStatusChip status={campaign.status} />
            <Chip label={campaign.source} variant="outlined" />
            <PilotBadge createdBy={campaign.createdBy} />
            <Box sx={{ flex: 1 }} />
            <RelativeTime value={campaign.startedAt} />
          </Stack>
          <Typography variant="body2Strong" noWrap>
            {campaign.query}
          </Typography>
          <Tooltip title={summaryHint(campaign)} enterDelay={400}>
            <Typography variant="captionMuted" sx={{ alignSelf: "flex-start" }}>
              {summaryLine(campaign)}
            </Typography>
          </Tooltip>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
