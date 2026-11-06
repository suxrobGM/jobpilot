"use client";

import type { ReactElement } from "react";
import { alpha, Box, type Theme } from "@mui/material";
import { editorial, type IconSizeToken, iconSizes } from "@/theme";

export type AgentOrbState = "off" | "connecting" | "ready" | "working" | "attention";

interface AgentOrbProps {
  state: AgentOrbState;
  size?: IconSizeToken;
}

const ROOT_ANIMATION: Record<AgentOrbState, string> = {
  off: "none",
  connecting: "none",
  ready: "agent-orb-breath 6s ease-in-out infinite",
  working: "agent-orb-breath 4s ease-in-out infinite",
  attention: "agent-orb-nudge 0.9s ease-out 1",
};

function ringColor(theme: Theme, state: AgentOrbState): string {
  if (state === "attention") {
    return editorial.amber;
  }
  if (state === "ready" || state === "working") {
    return theme.palette.accent.primary;
  }
  return theme.palette.text.disabled;
}

function coreBackground(theme: Theme, state: AgentOrbState): string {
  const accent = theme.palette.accent.primary;
  if (state === "connecting") {
    return `radial-gradient(circle, ${alpha(theme.palette.text.disabled, 0.5)} 0%, transparent 100%)`;
  }
  if (state === "attention") {
    return `radial-gradient(circle, ${editorial.amber} 0%, ${alpha(editorial.amber, 0)} 100%)`;
  }
  return `radial-gradient(circle, ${editorial.amber} 0%, ${alpha(accent, 0.87)} 50%, ${alpha(accent, 0)} 100%)`;
}

/** The agent's mark. Motion means it is working; a still orb is idle, offline or waiting on you. */
export function AgentOrb(props: AgentOrbProps): ReactElement {
  const { state, size = "2xxl" } = props;

  const sizePx = iconSizes[size];
  // Small orbs blur into a smudge with every layer, so the halo and counter-spin are large-only.
  const detailed = sizePx > iconSizes.lg;
  const ringInset = Math.max(2, Math.round(sizePx * 0.08));
  const coreInset = Math.max(4, Math.round(sizePx * 0.32));
  const glow = Math.round(sizePx * 0.5);
  const spinning = state === "connecting" || state === "working";

  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: "relative",
        flexShrink: 0,
        width: sizePx,
        height: sizePx,
        borderRadius: "50%",
        animation: ROOT_ANIMATION[state],
        "@keyframes agent-orb-breath": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "@keyframes agent-orb-nudge": {
          "0%, 100%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.15)" },
        },
        "@keyframes agent-orb-halo": {
          "0%, 100%": {
            boxShadow: `0 0 ${glow}px ${alpha(theme.palette.accent.primary, 0.2)}, 0 0 ${Math.round(glow * 0.5)}px ${alpha(theme.palette.accent.primary, 0.25)}`,
          },
          "50%": {
            boxShadow: `0 0 ${Math.round(glow * 1.6)}px ${alpha(theme.palette.accent.primary, 0.4)}, 0 0 ${glow}px ${alpha(theme.palette.accent.primary, 0.33)}`,
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
          animation:
            state === "working" && detailed ? "agent-orb-halo 3s ease-in-out infinite" : "none",
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          "& > *": { animation: "none !important" },
          "&::before": { animation: "none" },
        },
      })}
    >
      {state === "off" ? (
        <Box
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `1.5px dashed ${theme.palette.text.disabled}`,
          })}
        />
      ) : (
        <>
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              backgroundColor: alpha(ringColor(theme, state), state === "connecting" ? 0.25 : 0.35),
            })}
          />
          {spinning && (
            <Box
              sx={(theme) => {
                const head = state === "working" ? editorial.amber : theme.palette.text.secondary;
                const tail =
                  state === "working" ? theme.palette.accent.primary : theme.palette.text.disabled;
                return {
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: `conic-gradient(from 0deg, transparent 0deg, transparent 200deg, ${alpha(tail, 0.5)} 260deg, ${head} 330deg, ${alpha(editorial.paper, 0.8)} 350deg, transparent 360deg)`,
                  animation: `agent-orb-spin ${state === "working" ? 4.5 : 1.6}s linear infinite`,
                  mixBlendMode: "screen",
                };
              }}
            />
          )}
          {state === "working" && detailed && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: `conic-gradient(from 120deg, transparent 0deg, transparent 240deg, ${alpha(editorial.thrust, 0.35)} 320deg, transparent 360deg)`,
                animation: "agent-orb-counterspin 9s linear infinite",
                mixBlendMode: "screen",
                opacity: 0.7,
              }}
            />
          )}
          {/* donut hole - masks the ring layers in the middle */}
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: `${ringInset}px`,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, ${theme.palette.surfaces.elevated}, ${theme.palette.surfaces.base} 70%)`,
              boxShadow: `inset 0 0 ${Math.round(sizePx * 0.3)}px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`,
            })}
          />
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: `${coreInset}px`,
              borderRadius: "50%",
              background: coreBackground(theme, state),
              opacity: state === "ready" ? 0.85 : 1,
              animation: state === "working" ? "agent-orb-pulse 1.8s ease-in-out infinite" : "none",
              filter: "blur(0.5px)",
            })}
          />
        </>
      )}
    </Box>
  );
}
