"use client";

import type { ReactElement } from "react";
import { OpenInNew } from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { CampaignDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { CampaignStatusChip } from "./campaign-status-chip";
import { PilotBadge } from "./pilot-badge";

interface CampaignRowProps {
  campaign: CampaignDto;
  /** Primary click - e.g. open the campaign. */
  onSelect?: (campaign: CampaignDto) => void;
  /** Secondary affordance - open the full campaign detail. */
  onOpenDetail?: (campaign: CampaignDto) => void;
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
  const { campaign, onSelect, onOpenDetail } = props;

  return (
    <Card variant="interactive" sx={{ position: "relative" }}>
      <CardActionArea
        onClick={() => onSelect?.(campaign)}
        sx={{ padding: 1.25, paddingRight: onOpenDetail ? 4.5 : 1.25 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <CampaignStatusChip status={campaign.status} />
            <Chip label={campaign.source} variant="outlined" />
            <PilotBadge createdBy={campaign.createdBy} />
            <Box sx={{ flex: 1 }} />
            <Typography variant="captionMuted" noWrap>
              {formatRelativeTime(campaign.startedAt)}
            </Typography>
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
      {onOpenDetail && (
        <Box
          sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="Open campaign details" enterDelay={400}>
            <IconButton
              size="small"
              aria-label="Open campaign details"
              onClick={() => onOpenDetail(campaign)}
            >
              <OpenInNew fontSize="sm" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Card>
  );
}
