"use client";

import type { PilotState } from "@jobpilot/contracts/pilot";
import { useSuspenseQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

/** Never suspends: `PilotHome` mounts its parts only once the state has loaded. */
export function usePilotState(): PilotState {
  return useSuspenseQuery(pilotQueries.state()).data;
}
