"use client";

import type { ReactElement } from "react";
import { Box, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { PipelineJobDto } from "@/api/types";

interface ScoreBadgeProps {
  job: PipelineJobDto;
}

function scoreHint(score: number | null, bar: number): string {
  if (score === null) {
    return "Not scored yet. The pilot reads it on its next pass.";
  }
  return score >= bar ? `At or above your bar of ${bar}` : `Below your bar of ${bar}`;
}

/** The match score against the job's own bar: green at or above, muted below, dashed when unread. */
export function ScoreBadge(props: ScoreBadgeProps): ReactElement {
  const { job } = props;
  const score = job.matchScore;
  const strong = score !== null && score >= job.minScore;
  return (
    <Tooltip title={scoreHint(score, job.minScore)}>
      <Box
        sx={(theme) => ({
          minWidth: 36,
          px: 0.75,
          py: 0.25,
          flexShrink: 0,
          borderRadius: 1,
          border: 1,
          textAlign: "center",
          typography: "body2Strong",
          fontVariantNumeric: "tabular-nums",
          color: "text.secondary",
          borderColor: "divider",
          ...(strong && {
            color: "success.main",
            borderColor: alpha(theme.palette.success.main, 0.4),
            bgcolor: alpha(theme.palette.success.main, 0.1),
          }),
          ...(score === null && { color: "text.disabled", borderStyle: "dashed" }),
        })}
      >
        {score ?? "—"}
      </Box>
    </Tooltip>
  );
}
