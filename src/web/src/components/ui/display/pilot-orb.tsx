"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { iconSizes, type IconSizeToken } from "@/theme/tokens";

interface PilotOrbProps {
  /** Either a px value or one of the shared {@link IconSizeToken}s. */
  size?: number | IconSizeToken;
  breathing?: boolean;
  liveDot?: boolean;
}

function resolveSize(size: PilotOrbProps["size"]): number {
  if (size == null) {
    return iconSizes["2xxl"];
  }
  return typeof size === "number" ? size : iconSizes[size];
}

export function PilotOrb(props: PilotOrbProps): ReactElement {
  const { size, breathing = true, liveDot = false } = props;

  const sizePx = resolveSize(size);
  const innerInset = Math.max(3, Math.round(sizePx * 0.12));
  const dotSize = Math.max(7, Math.round(sizePx * 0.28));
  const glow = Math.round(sizePx * 0.45);

  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: "relative",
        width: sizePx,
        height: sizePx,
        borderRadius: "50%",
        background: theme.gradients.orb,
        boxShadow: `0 0 ${glow}px ${theme.palette.accent.primary}40`,
        animation: breathing ? "pilot-orb-breath 6s ease-in-out infinite" : "none",
        "@keyframes pilot-orb-breath": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: `${innerInset}px`,
          borderRadius: "50%",
          background: theme.palette.surfaces.base,
        },
      })}
    >
      {liveDot && (
        <Box
          aria-hidden
          sx={(theme) => ({
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            backgroundColor: theme.palette.success.main,
            boxShadow: `0 0 0 2px ${theme.palette.surfaces.base}`,
            zIndex: 2,
          })}
        />
      )}
    </Box>
  );
}
