"use client";

import type { ReactElement } from "react";
import { Box, type Theme } from "@mui/material";

export type PulseDotTone = "violet" | "green" | "amber" | "red" | "blue" | "peach" | "muted";

export type PulseDotSize = "xs" | "sm" | "md";

interface PulseDotProps {
  tone?: PulseDotTone;
  size?: PulseDotSize;
  pulsing?: boolean;
}

const DOT_SIZE: Record<PulseDotSize, number> = { xs: 5, sm: 7, md: 9 };

function toneColor(theme: Theme, tone: PulseDotTone): string {
  switch (tone) {
    case "violet":
      return theme.palette.accent.primary;
    case "green":
      return theme.palette.success.main;
    case "amber":
      return theme.palette.warning.main;
    case "red":
      return theme.palette.error.main;
    case "blue":
      return theme.palette.info.main;
    case "peach":
      return theme.palette.stages.interviewing;
    case "muted":
    default:
      return theme.palette.text.disabled;
  }
}

export function PulseDot(props: PulseDotProps): ReactElement {
  const { tone = "muted", size = "sm", pulsing = false } = props;
  const px = DOT_SIZE[size];
  return (
    <Box
      aria-hidden
      sx={(theme) => {
        const color = toneColor(theme, tone);
        return {
          display: "inline-block",
          width: px,
          height: px,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: pulsing ? `0 0 0 3px ${color}30` : "none",
          animation: pulsing ? "pulse-dot 2.4s ease-in-out infinite" : "none",
          flexShrink: 0,
          "@keyframes pulse-dot": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.45 },
          },
        };
      }}
    />
  );
}
