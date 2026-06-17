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

// Standard keys via theme.vars (raw theme.palette.* drifts SSR vs client under
// cssVariables); custom keys (accent/stages) have no var and stay raw hex.
function toneColor(theme: Theme, tone: PulseDotTone): string {
  const vars = theme.vars ?? theme;
  switch (tone) {
    case "violet":
      return theme.palette.accent.primary;
    case "green":
      return vars.palette.success.main;
    case "amber":
      return vars.palette.warning.main;
    case "red":
      return vars.palette.error.main;
    case "blue":
      return vars.palette.info.main;
    case "peach":
      return theme.palette.stages.interviewing;
    case "muted":
    default:
      return vars.palette.text.disabled;
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
          boxShadow: pulsing ? `0 0 0 3px color-mix(in srgb, ${color} 19%, transparent)` : "none",
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
