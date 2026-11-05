"use client";

import type { PilotState } from "@jobpilot/contracts/pilot";
import { type TerminalHealth, useTerminalHealth } from "@/hooks/use-terminal-health";
import type { PilotHealth } from "@/lib/terminal/client";
import { type PilotMode, pilotMode } from "./pilot-status";

interface PilotStatus {
  health: TerminalHealth;
  pilot: PilotHealth | null;
  mode: PilotMode;
}

export function usePilotStatus(state: PilotState, expectingReturn = false): PilotStatus {
  const { health, status } = useTerminalHealth(expectingReturn);
  const pilot = status?.pilot ?? null;
  return { health, pilot, mode: pilotMode(state, health, pilot) };
}
