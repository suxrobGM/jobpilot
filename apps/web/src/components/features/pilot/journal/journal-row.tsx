"use client";

import type { ReactElement } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  Autorenew,
  Bolt,
  NotificationImportant,
  Rule,
  Summarize,
  Terminal,
  Visibility,
} from "@mui/icons-material";
import { Box, Chip, type ChipProps, Stack, Typography } from "@mui/material";
import { formatRelativeTime } from "@/utils/format";

export const KIND_META: Record<
  PilotJournalKind,
  { icon: SvgIconComponent; color: ChipProps["color"]; label: string }
> = {
  cycle: { icon: Autorenew, color: "primary", label: "Cycle" },
  action: { icon: Bolt, color: "info", label: "Action" },
  observation: { icon: Visibility, color: "default", label: "Note" },
  question: { icon: NotificationImportant, color: "warning", label: "Question" },
  system: { icon: Terminal, color: "default", label: "System" },
  digest: { icon: Summarize, color: "success", label: "Summary" },
  correction: { icon: Rule, color: "secondary", label: "Adjustment" },
};

const n = (detail: Record<string, unknown>, key: string): number =>
  typeof detail[key] === "number" ? (detail[key] as number) : 0;

/** Glanceable counts from a digest entry's 24h detail, mirroring the summary's fields. */
function DigestCounts(props: { detail: Record<string, unknown> }): ReactElement {
  const { detail } = props;
  const parts = [
    `${n(detail, "applicationsCreated")} applied`,
    `${n(detail, "jobsFailed") + n(detail, "jobsSkipped")} not applied`,
    `${n(detail, "networkingSent")} networking (${n(detail, "networkingReplies")} replies)`,
    `${n(detail, "promotionsPosted")} posts`,
    `${n(detail, "openQuestions")} open`,
  ];
  return <Typography variant="captionMuted">{parts.join(" · ")}</Typography>;
}

export function dedupeById(entries: PilotJournalEntry[]): PilotJournalEntry[] {
  const seen = new Set<string>();
  const out: PilotJournalEntry[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function JournalRow(props: { entry: PilotJournalEntry }): ReactElement {
  const { entry } = props;
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Chip
        size="small"
        color={meta.color}
        icon={<Icon fontSize="sm" />}
        label={meta.label}
        sx={{ minWidth: 110 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">{entry.summary}</Typography>
        {entry.kind === "digest" && <DigestCounts detail={entry.detail} />}
      </Box>
      <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
        {formatRelativeTime(entry.createdAt)} ago
      </Typography>
    </Stack>
  );
}
