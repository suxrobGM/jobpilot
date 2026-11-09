"use client";

import type { ReactElement } from "react";
import { Box, type Theme } from "@mui/material";

export type PulseDotTone = "primary" | "success" | "warning" | "error" | "info" | "muted";

type PulseDotSize = "xs" | "sm" | "md";

interface PulseDotProps {
  tone?: PulseDotTone;
  size?: PulseDotSize;
  pulsing?: boolean;
}

const DOT_SIZE: Record<PulseDotSize, number> = { xs: 5, sm: 7, md: 9 };

// theme.vars: raw theme.palette values drift between SSR and client under cssVariables.
function toneColor(theme: Theme, tone: PulseDotTone): string {
  const { palette } = theme.vars ?? theme;
  return tone === "muted" ? palette.text.disabled : palette[tone].main;
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
