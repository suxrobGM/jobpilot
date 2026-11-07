"use client";

import type { ReactElement } from "react";
import { ButtonBase, Typography } from "@mui/material";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";
import { useAgentActivity } from "./use-agent-activity";

/** The phone top bar's agent status (the rail has its own on desktop), and the way into its drawer. */
export function AgentPill(): ReactElement {
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { orb, label } = useAgentActivity();
  const text = orb === "working" ? label : `Agent ${label}`;

  return (
    <ButtonBase
      aria-label={drawerOpen ? "Close agent" : `Open agent: ${text}`}
      aria-pressed={drawerOpen}
      onClick={drawerOpen ? closeDrawer : openDrawer}
      sx={(theme) => ({
        gap: 1,
        minWidth: 0,
        height: theme.controlHeights.sm,
        paddingInline: { xs: 0.75, sm: 1.25 },
        borderRadius: theme.radii.md,
        border: `1px solid ${theme.palette.line.borderHi}`,
        backgroundColor: drawerOpen ? theme.palette.surfaces.elevated : "transparent",
        transition: theme.motion.fast,
        "&:hover": { backgroundColor: theme.palette.surfaces.card },
        "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
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
