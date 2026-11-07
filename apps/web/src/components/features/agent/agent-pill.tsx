"use client";

import type { ReactElement } from "react";
import { ButtonBase, Typography } from "@mui/material";
import { AgentOrb } from "./agent-orb";
import { useAgentToggle } from "./use-agent-toggle";

/** The phone top bar's agent status (the rail has its own on desktop), and the way into its drawer. */
export function AgentPill(): ReactElement {
  const { orb, text, open, buttonProps } = useAgentToggle();

  return (
    <ButtonBase
      {...buttonProps}
      sx={(theme) => ({
        gap: 1,
        minWidth: 0,
        height: theme.controlHeights.sm,
        paddingInline: { xs: 0.75, sm: 1.25 },
        borderRadius: theme.radii.md,
        border: `1px solid ${theme.palette.line.borderHi}`,
        backgroundColor: open ? theme.palette.surfaces.elevated : "transparent",
        transition: theme.motion.fast,
        "&:hover": { backgroundColor: theme.palette.surfaces.card },
      })}
    >
      <AgentOrb state={orb} size="sm" />
      <Typography
        variant="body2"
        noWrap
        sx={{
          display: { xs: "none", sm: "block" },
          maxWidth: 220,
          color: orb === "working" ? "text.primary" : "text.secondary",
        }}
      >
        {text}
      </Typography>
    </ButtonBase>
  );
}
