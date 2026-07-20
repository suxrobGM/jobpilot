"use client";

import type { ReactElement } from "react";
import type { CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { Box, Stack, Typography } from "@mui/material";
import type { CampaignDetailDto, CampaignJobDto } from "@/api/types";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";

type StageColor = "pipeline" | "success" | "skipped" | "failed";

interface Row {
  key: string;
  label: string;
  count: number;
  color: StageColor;
  /** Drop-off branches indent under the stage they leave. */
  branch?: boolean;
  active?: boolean;
}

function countByStatus(jobs: ReadonlyArray<CampaignJobDto>): {
  byStatus: Record<CampaignJobStatus, number>;
  scoredCount: number;
} {
  const byStatus = {
    pending: 0,
    approved: 0,
    applying: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
    needs_user: 0,
  } as Record<CampaignJobStatus, number>;
  let scoredCount = 0;
  for (const job of jobs) {
    byStatus[job.status] += 1;
    if (job.matchScore != null) {
      scoredCount += 1;
    }
  }
  return { byStatus, scoredCount };
}

/** Single in-flight funnel stage while a campaign runs, checked in frontier order (furthest along wins). */
const ACTIVE_FRONTIER: ReadonlyArray<{
  key: "applying" | "approved" | "scored";
  has: (c: Record<CampaignJobStatus, number>) => boolean;
}> = [
  { key: "applying", has: (c) => c.applying > 0 },
  { key: "approved", has: (c) => c.approved > 0 },
  { key: "scored", has: (c) => c.pending > 0 },
];

/**
 * Cumulative "reached at least this stage" counts, clamped monotonic so the funnel never widens
 * downstream. A failed job passed through applying; a skipped job was dropped at scoring.
 */
function buildRows(campaign: CampaignDetailDto): { rows: Row[]; max: number } {
  const { byStatus: counts, scoredCount } = countByStatus(campaign.jobs);
  const applies = campaign.source !== "search";
  const inProgress = campaign.status === "in_progress";

  const applied = counts.applied;
  const applying = counts.applying + counts.applied + counts.failed;
  const approved = counts.approved + counts.needs_user + applying;
  const scored = Math.max(scoredCount, approved + counts.skipped);
  const found = Math.max(campaign.summary.totalFound, campaign.jobs.length, scored);

  // The single in-flight frontier, so only one stage pulses while running.
  const active = inProgress ? (ACTIVE_FRONTIER.find((s) => s.has(counts))?.key ?? null) : null;

  const rows: Row[] = [
    { key: "found", label: "Found", count: found, color: "pipeline" },
    {
      key: "scored",
      label: "Scored",
      count: scored,
      color: "pipeline",
      active: active === "scored",
    },
  ];
  if (counts.skipped > 0) {
    rows.push({
      key: "skipped",
      label: "Skipped",
      count: counts.skipped,
      color: "skipped",
      branch: true,
    });
  }
  if (applies) {
    rows.push({
      key: "approved",
      label: "Approved",
      count: approved,
      color: "pipeline",
      active: active === "approved",
    });
    rows.push({
      key: "applying",
      label: "Applying",
      count: applying,
      color: "pipeline",
      active: active === "applying",
    });
    if (counts.failed > 0) {
      rows.push({
        key: "failed",
        label: "Failed",
        count: counts.failed,
        color: "failed",
        branch: true,
      });
    }
    rows.push({ key: "applied", label: "Applied", count: applied, color: "success" });
  }

  return { rows, max: Math.max(found, 1) };
}

const FILL: Record<StageColor, string> = {
  pipeline: "primary.main",
  success: "success.main",
  skipped: "text.disabled",
  failed: "error.main",
};

const ACTIVE_TONE: Record<StageColor, PulseDotTone> = {
  pipeline: "violet",
  success: "green",
  skipped: "muted",
  failed: "red",
};

function StageRow(props: { row: Row; max: number }): ReactElement {
  const { row, max } = props;
  const pct = row.count > 0 ? Math.max(4, (row.count / max) * 100) : 0;

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", pl: row.branch ? 3 : 0 }}>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ width: 104, flexShrink: 0, alignItems: "center" }}
      >
        {row.active && <PulseDot tone={ACTIVE_TONE[row.color]} size="xs" pulsing />}
        <Typography variant={row.branch ? "captionMuted" : "body2"} sx={{ minWidth: 0 }} noWrap>
          {row.branch ? `↳ ${row.label}` : row.label}
        </Typography>
      </Stack>
      <Box
        sx={{
          flex: 1,
          height: row.branch ? 16 : 24,
          borderRadius: 1,
          backgroundColor: "action.hover",
          overflow: "hidden",
        }}
      >
        <Box
          sx={(theme) => ({
            width: `${pct}%`,
            height: "100%",
            borderRadius: 1,
            backgroundColor: FILL[row.color],
            transition: theme.transitions.create("width"),
          })}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{ width: 36, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
      >
        {row.count}
      </Typography>
    </Stack>
  );
}

interface PipelineFunnelProps {
  campaign: CampaignDetailDto;
}

/** Funnel of the campaign's job pipeline (found → applied) with skip/fail drop-off branches. */
export function PipelineFunnel(props: PipelineFunnelProps): ReactElement | null {
  const { campaign } = props;
  const { rows, max } = buildRows(campaign);

  if (max <= 1 && campaign.jobs.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Pipeline" description="How jobs move from discovery to applied.">
      <Stack spacing={1.25}>
        {rows.map((row) => (
          <StageRow key={row.key} row={row} max={max} />
        ))}
      </Stack>
    </SectionCard>
  );
}
