"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { editorial } from "@/theme/palette";
import { iconSizes, type IconSizeToken } from "@/theme/tokens";

interface AgentOrbProps {
  size?: IconSizeToken;
}

/** A visual representation of an agent in the dock with a pulsing animation */
export function AgentOrb(props: AgentOrbProps): ReactElement {
  const { size = "2xxl" } = props;

  const sizePx = iconSizes[size];
  const ringInset = Math.max(2, Math.round(sizePx * 0.08));
  const coreInset = Math.max(4, Math.round(sizePx * 0.32));
  const glow = Math.round(sizePx * 0.5);

  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: "relative",
        width: sizePx,
        height: sizePx,
        borderRadius: "50%",
        animation: "agent-orb-breath 4s ease-in-out infinite",
        "@keyframes agent-orb-breath": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "@keyframes agent-orb-halo": {
          "0%, 100%": {
            boxShadow: `0 0 ${glow}px ${theme.palette.accent.primary}33, 0 0 ${Math.round(glow * 0.5)}px ${theme.palette.accent.primary}40`,
          },
          "50%": {
            boxShadow: `0 0 ${Math.round(glow * 1.6)}px ${theme.palette.accent.primary}66, 0 0 ${glow}px ${theme.palette.accent.primary}55`,
          },
        },
        "@keyframes agent-orb-spin": {
          to: { transform: "rotate(360deg)" },
        },
        "@keyframes agent-orb-counterspin": {
          to: { transform: "rotate(-360deg)" },
        },
        "@keyframes agent-orb-pulse": {
          "0%, 100%": { transform: "scale(0.8)", opacity: 0.7 },
          "50%": { transform: "scale(1.15)", opacity: 1 },
        },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          animation: "agent-orb-halo 3s ease-in-out infinite",
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          "& > *": { animation: "none !important" },
          "&::before": { animation: "none" },
        },
      })}
    >
      {/* dim base ring so the donut has substance when the comet is on the far side */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from 0deg, ${theme.palette.accent.primary}33, ${editorial.gold}26, ${editorial.sage}1F, ${theme.palette.accent.primary}33)`,
        })}
      />
      {/* fast bright comet sweep */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from 0deg,
            transparent 0deg,
            transparent 200deg,
            ${theme.palette.accent.primary}80 260deg,
            ${editorial.gold}FF 330deg,
            ${editorial.paper}CC 350deg,
            transparent 360deg)`,
          animation: "agent-orb-spin 4.5s linear infinite",
          mixBlendMode: "screen",
        })}
      />
      {/* slower counter-rotating dim arc — adds depth */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from 120deg,
            transparent 0deg,
            transparent 240deg,
            ${editorial.sage}59 320deg,
            transparent 360deg)`,
          animation: "agent-orb-counterspin 9s linear infinite",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
      />
      {/* donut hole — masks the rotating layers in the middle */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: `${ringInset}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${theme.palette.surfaces.elevated}, ${theme.palette.surfaces.base} 70%)`,
          boxShadow: `inset 0 0 ${Math.round(sizePx * 0.3)}px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`,
        })}
      />
      {/* heartbeat core */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: `${coreInset}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${editorial.gold}FF 0%, ${theme.palette.accent.primary}DD 50%, ${theme.palette.accent.primary}00 100%)`,
          animation: "agent-orb-pulse 1.8s ease-in-out infinite",
          filter: "blur(0.5px)",
        })}
      />
    </Box>
  );
}
