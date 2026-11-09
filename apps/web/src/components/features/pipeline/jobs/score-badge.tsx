"use client";

import type { ReactElement } from "react";
import { Box, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

interface ScoreBadgeProps {
  /** Null until the pilot scores the job. */
  score: number | null;
  /** The job's own minimum score. */
  bar: number;
}

function scoreHint(score: number | null, bar: number): string {
  if (score === null) {
    return "Not scored yet. The pilot reads it on its next pass.";
  }
  return score >= bar ? `At or above your bar of ${bar}` : `Below your bar of ${bar}`;
}

/** The match score against the job's own bar: green at or above, muted below, dashed when unread. */
export function ScoreBadge(props: ScoreBadgeProps): ReactElement {
  const { score, bar } = props;
  const strong = score !== null && score >= bar;
  return (
    <Tooltip title={scoreHint(score, bar)}>
      <Box
        sx={(theme) => ({
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          // Above the row's stretched open-link, so the hint still shows on hover.
          position: "relative",
          zIndex: 1,
          borderRadius: theme.radii.md,
          border: 1,
          typography: "body2Strong",
          fontVariantNumeric: "tabular-nums",
          color: "text.secondary",
          borderColor: "transparent",
          backgroundColor: theme.palette.surfaces.elevated,
          ...(strong && {
            color: "success.main",
            backgroundColor: alpha(theme.palette.success.main, 0.12),
          }),
          ...(score === null && {
            color: "text.disabled",
            borderColor: "line.borderHi",
            borderStyle: "dashed",
            backgroundColor: "transparent",
          }),
        })}
      >
        {score ?? "—"}
      </Box>
    </Tooltip>
  );
}
