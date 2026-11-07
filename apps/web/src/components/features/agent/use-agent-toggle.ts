"use client";

import { useAgentDrawer } from "@/providers/agent-provider";
import type { AgentOrbState } from "./agent-orb";
import { useAgentActivity } from "./use-agent-activity";

interface AgentToggle {
  orb: AgentOrbState;
  text: string;
  buttonProps: {
    "aria-label": string;
    "aria-pressed": boolean;
    onClick: () => void;
  };
  open: boolean;
}

/** Shared by the rail button and the phone pill. */
export function useAgentToggle(): AgentToggle {
  const { drawerOpen, openDrawer, closeDrawer } = useAgentDrawer();
  const { orb, label } = useAgentActivity();
  const text = orb === "working" ? label : `Agent · ${label}`;
  return {
    orb,
    text,
    open: drawerOpen,
    buttonProps: {
      "aria-label": drawerOpen ? "Close agent" : `Open agent: ${text}`,
      "aria-pressed": drawerOpen,
      onClick: drawerOpen ? closeDrawer : openDrawer,
    },
  };
}
