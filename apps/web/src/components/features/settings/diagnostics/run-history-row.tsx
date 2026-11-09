"use client";

import type { ReactElement } from "react";
import type { PilotRunHistoryItem, PilotRunOutcome } from "@jobpilot/contracts/pilot";
import { AGENT_LABELS, taskTypeAgent } from "@jobpilot/contracts/pilot";
import type { SvgIconComponent } from "@mui/icons-material";
import { Block, CheckCircleOutlined, ErrorOutlined, TimerOff } from "@mui/icons-material";
import { alpha, Box, Stack, Tooltip, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { formatTokenSplit, humanizeIsoInText } from "@/utils/format";

export const OUTCOME_META: Record<
  PilotRunOutcome,
  { icon: SvgIconComponent; color: "success" | "error" | "warning" | "default"; label: string }
> = {
  done: { icon: CheckCircleOutlined, color: "success", label: "Done" },
  failed: { icon: ErrorOutlined, color: "error", label: "Failed" },
  cancelled: { icon: Block, color: "default", label: "Cancelled" },
  expired: { icon: TimerOff, color: "warning", label: "Expired" },
};

export const OUTCOME_ORDER = Object.keys(OUTCOME_META) as PilotRunOutcome[];

interface RunHistoryRowProps {
  run: PilotRunHistoryItem;
}

export function RunHistoryRow(props: RunHistoryRowProps): ReactElement {
  const { run } = props;
  const meta = OUTCOME_META[run.outcome];
  const Icon = meta.icon;
  const agent = AGENT_LABELS[taskTypeAgent(run.taskType)];
  const tokens = run.tokens === null ? "" : ` · ${formatTokenSplit(run.tokens)}`;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Tooltip title={meta.label}>
        <Box
          aria-label={meta.label}
          sx={(theme) => {
            const color =
              meta.color === "default"
                ? theme.palette.text.secondary
                : theme.palette[meta.color].main;
            return {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: theme.radii.sm,
              color,
              backgroundColor: alpha(color, 0.14),
            };
          }}
        >
          <Icon fontSize="sm" />
        </Box>
      </Tooltip>
      <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
        <Typography variant="body2">{humanizeIsoInText(run.summary ?? run.title)}</Typography>
        <Typography variant="captionMuted">{`${agent}${tokens}`}</Typography>
      </Box>
      <RelativeTime value={run.finishedAt} sx={{ whiteSpace: "nowrap", pt: 0.5 }} />
    </Stack>
  );
}
