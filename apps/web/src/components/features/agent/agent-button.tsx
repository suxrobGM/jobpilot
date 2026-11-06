"use client";

import type { ReactElement } from "react";
import { ButtonBase, Tooltip, Typography } from "@mui/material";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";
import { useAgentActivity } from "./use-agent-activity";

interface AgentButtonProps {
  collapsed: boolean;
}

/** The sidebar's Agent row: opens and closes the agent drawer, showing what the agent is doing. */
export function AgentButton(props: AgentButtonProps): ReactElement {
  const { collapsed } = props;
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { orb, label } = useAgentActivity();
  const text = orb === "working" ? label : `Agent · ${label}`;

  return (
    <Tooltip title={collapsed ? text : ""} placement="right" arrow>
      <ButtonBase
        aria-label={drawerOpen ? "Close agent" : "Open agent"}
        aria-pressed={drawerOpen}
        onClick={drawerOpen ? closeDrawer : openDrawer}
        sx={(theme) => ({
          justifyContent: "flex-start",
          gap: 1.5,
          height: 36,
          paddingInline: 0.75,
          borderRadius: theme.radii.sm,
          backgroundColor: drawerOpen ? theme.palette.surfaces.elevated : "transparent",
          "&:hover": { backgroundColor: theme.palette.surfaces.card },
          "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
        })}
      >
        <AgentOrb state={orb} size="lg" />
        {!collapsed && (
          <Typography
            variant="body2"
            noWrap
            sx={{ color: orb === "working" ? "text.primary" : "text.secondary", minWidth: 0 }}
          >
            {text}
          </Typography>
        )}
      </ButtonBase>
    </Tooltip>
  );
}
