"use client";

import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { type TerminalHealth, useTerminalHealth } from "@/hooks/use-terminal-health";
import { pilotMode } from "../pilot/pilot-status";
import type { AgentOrbState } from "./agent-orb";

const HEALTH_ORB: Record<TerminalHealth, AgentOrbState> = {
  checking: "connecting",
  reachable: "ready",
  degraded: "attention",
  offline: "off",
  uninstalled: "off",
  blocked: "attention",
};

const HEALTH_LABELS: Record<TerminalHealth, string> = {
  checking: "connecting",
  reachable: "ready",
  degraded: "needs reinstall",
  offline: "offline",
  uninstalled: "not installed",
  blocked: "blocked by browser",
};

interface AgentActivity {
  health: TerminalHealth;
  orb: AgentOrbState;
  /** The running task's title, else the host's health, e.g. "offline". */
  label: string;
}

/** What the agent is doing right now, for its orb and one-line label. */
export function useAgentActivity(): AgentActivity {
  const { health, status } = useTerminalHealth();
  const { data: state } = useQuery(pilotQueries.state());
  // The same rule as the pilot's status line, so the two never disagree on working.
  const working =
    health === "reachable" &&
    state &&
    pilotMode(state, health, status?.pilot ?? null) === "working";

  if (working) {
    return { health, orb: "working", label: state.currentRun?.title ?? "working" };
  }
  return { health, orb: HEALTH_ORB[health], label: HEALTH_LABELS[health] };
}
