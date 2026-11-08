"use client";

import type { PilotState } from "@jobpilot/contracts/pilot";
import { useClockTick } from "@/hooks/use-clock-tick";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import type { PilotHealth } from "@/lib/terminal/client";
import { type PilotMode, pilotMode } from "./pilot-mode";

interface PilotStatus {
  pilot: PilotHealth | null;
  mode: PilotMode;
  /** The host's next check. */
  nextWakeAt: Date | null;
}

/** Re-renders on the shared clock tick, so the wake countdown keeps moving. */
export function usePilotStatus(state: PilotState): PilotStatus {
  useClockTick();
  const { health, status } = useTerminalHealth();
  const pilot = status?.pilot ?? null;
  return { pilot, mode: pilotMode(state, health, pilot), nextWakeAt: state.nextWakeAt ?? null };
}
