"use client";

import type { PilotState } from "@jobpilot/contracts/pilot";
import { useClockTick } from "@/hooks/use-clock-tick";

/** The host's next check; re-renders the caller on the shared tick so a countdown keeps moving. */
export function useNextWake(state: PilotState | null): Date | null {
  useClockTick();
  return state?.nextWakeAt ?? null;
}
