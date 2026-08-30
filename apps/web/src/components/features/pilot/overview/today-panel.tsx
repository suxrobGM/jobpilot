"use client";

import type { ReactElement, ReactNode } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";

interface MeterProps {
  label: string;
  value: number;
  cap: number;
  /** Turns the bar red, so a capped pilot doesn't read as broken. */
  spent: boolean;
}

export function Meter(props: MeterProps): ReactElement {
  const { label, value, cap, spent } = props;
  const percent = cap > 0 ? Math.min(100, (value / cap) * 100) : 0;

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography variant="body2Muted">{label}</Typography>
        <Typography variant="body2" color={spent ? "error.main" : "text.primary"}>
          {value} / {cap}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} color={spent ? "error" : "primary"} />
    </Stack>
  );
}

/** The API sends bucket slugs, so this stays the only copy of the wording. */
const SKIP_LABELS: Record<string, string> = {
  sponsorship: "No visa sponsorship",
  citizenship: "Citizenship required",
  clearance: "Security clearance required",
  alreadyApplied: "Already applied",
  captcha: "CAPTCHA",
  payment: "Payment required",
  belowMinScore: "Below min score",
  capReached: "Daily cap reached",
  postingClosed: "Posting closed",
  wentStale: "Went stale before applying",
  goalsChanged: "Dropped when goals changed",
  unanswered: "Question went unanswered",
  other: "Other",
};

/** Past this ratio of skips to applies, the searches or the score bar are wrong, not the pilot. */
const SKIP_RATIO_WARNING = 2;

const TOP_REASONS = 3;

interface TodayOutcomesProps {
  appliedToday: number;
}

/** Without this, "16 applied" beside 52 quiet skips reads as a slow day, not a bad search. */
export function TodayOutcomes(props: TodayOutcomesProps): ReactNode {
  const { appliedToday } = props;
  const query = useApiQuery(pilotQueries.todayOutcomes());
  const outcomes = query.data;

  if (!outcomes || outcomes.skipped + outcomes.failed === 0) {
    return null;
  }

  const parts = [`${appliedToday} applied`, `${outcomes.skipped} skipped`];
  if (outcomes.failed > 0) {
    parts.push(`${outcomes.failed} failed`);
  }
  const mostlySkipped = outcomes.skipped > Math.max(appliedToday, 1) * SKIP_RATIO_WARNING;

  return (
    <Stack spacing={0.5}>
      <Typography variant="captionMuted">{parts.join(" · ")}</Typography>
      {outcomes.skipReasons.slice(0, TOP_REASONS).map((row) => (
        <Stack key={row.reason} direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography variant="captionMuted">
            {SKIP_LABELS[row.reason] ?? SKIP_LABELS.other}
          </Typography>
          <Typography variant="captionMuted">{row.count}</Typography>
        </Stack>
      ))}
      {mostlySkipped && (
        <Typography variant="caption" color="warning.main">
          Most jobs are being skipped. Lower the min score, or point your searches somewhere else.
        </Typography>
      )}
    </Stack>
  );
}
