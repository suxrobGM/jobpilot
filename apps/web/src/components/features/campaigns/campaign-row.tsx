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
import { ColorChip } from "@/components/ui/display";
import { formatRelativeTime } from "@/utils/format";
import { CAMPAIGN_STATUS_COLOR, CAMPAIGN_STATUS_LABEL } from "./campaign-status";

interface CampaignRowProps {
  campaign: CampaignDto;
  /** Highlights the row as the active board scope. */
  selected?: boolean;
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

export function CampaignRow(props: CampaignRowProps): ReactElement {
  const { campaign, selected = false, onSelect, onOpenDetail } = props;

  return (
    <Card
      variant="interactive"
      sx={(theme) => ({
        position: "relative",
        ...(selected && {
          borderColor: theme.palette.accent.primary,
          backgroundColor: "action.selected",
        }),
      })}
    >
      <CardActionArea
        aria-pressed={selected}
        onClick={() => onSelect?.(campaign)}
        sx={{ padding: 1.25, paddingRight: onOpenDetail ? 4.5 : 1.25 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <ColorChip
              value={campaign.status}
              colors={CAMPAIGN_STATUS_COLOR}
              label={CAMPAIGN_STATUS_LABEL[campaign.status]}
            />
            <Chip size="small" label={campaign.source} variant="outlined" />
            <Box sx={{ flex: 1 }} />
            <Typography variant="captionMuted" noWrap>
              {formatRelativeTime(campaign.startedAt)}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {campaign.query}
          </Typography>
          <Typography variant="captionMuted">{summaryLine(campaign)}</Typography>
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
