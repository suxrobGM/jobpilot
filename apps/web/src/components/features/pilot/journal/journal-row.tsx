"use client";

import type { ReactElement } from "react";
import type {
  PilotJournalEntry,
  PilotJournalKind,
  PilotJournalRun,
} from "@jobpilot/contracts/pilot";
import { AGENT_LABELS, taskTypeAgent } from "@jobpilot/contracts/pilot";
import type { SvgIconComponent } from "@mui/icons-material";
import { Bolt, NotificationImportant, Rule, Summarize, Terminal } from "@mui/icons-material";
import { alpha, Box, type ChipProps, Stack, Tooltip, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { formatTokenSplit, humanizeIsoInText } from "@/utils/format";

export const KIND_META: Record<
  PilotJournalKind,
  { icon: SvgIconComponent; color: ChipProps["color"]; label: string }
> = {
  action: { icon: Bolt, color: "info", label: "Action" },
  question: { icon: NotificationImportant, color: "warning", label: "Question" },
  system: { icon: Terminal, color: "default", label: "System" },
  digest: { icon: Summarize, color: "success", label: "Summary" },
  correction: { icon: Rule, color: "secondary", label: "Adjustment" },
};

export const KIND_ORDER = Object.keys(KIND_META) as PilotJournalKind[];

type JournalDetail = PilotJournalEntry["detail"];

function detailCount(detail: JournalDetail, key: string): number {
  const value = detail[key];
  return typeof value === "number" ? value : 0;
}

interface DigestCountsProps {
  detail: JournalDetail;
}

export function DigestCounts(props: DigestCountsProps): ReactElement {
  const { detail } = props;
  const parts = [
    `${detailCount(detail, "applicationsCreated")} applied`,
    `${detailCount(detail, "jobsFailed") + detailCount(detail, "jobsSkipped")} not applied`,
    `${detailCount(detail, "networkingSent")} networking (${detailCount(detail, "networkingReplies")} replies)`,
    `${detailCount(detail, "openQuestions")} open`,
  ];
  return <Typography variant="captionMuted">{parts.join(" · ")}</Typography>;
}

interface RunMetaProps {
  run: PilotJournalRun;
}

export function RunMeta(props: RunMetaProps): ReactElement {
  const { run } = props;
  const agent = AGENT_LABELS[taskTypeAgent(run.taskType)];
  const tokens = run.tokens === null ? "" : ` · ${formatTokenSplit(run.tokens)}`;
  return <Typography variant="captionMuted">{`${agent}${tokens}`}</Typography>;
}

interface JournalRowProps {
  entry: PilotJournalEntry;
}

export function JournalRow(props: JournalRowProps): ReactElement {
  const { entry } = props;
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Tooltip title={meta.label}>
        <Box
          aria-label={meta.label}
          sx={(theme) => {
            const color =
              meta.color === "default" || meta.color === undefined
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
        <Typography variant="body2">{humanizeIsoInText(entry.summary)}</Typography>
        {entry.kind === "digest" && <DigestCounts detail={entry.detail} />}
        {entry.run && <RunMeta run={entry.run} />}
      </Box>
      <RelativeTime value={entry.createdAt} sx={{ whiteSpace: "nowrap", pt: 0.5 }} />
    </Stack>
  );
}
