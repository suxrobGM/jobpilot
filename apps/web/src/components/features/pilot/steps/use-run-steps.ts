"use client";

import type { PilotStep } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

const NO_STEPS: PilotStep[] = [];

/** The running task's steps; `PilotLive` appends new ones as they stream in. */
export function useRunSteps(runId: string | null): PilotStep[] {
  const query = useQuery({ ...pilotQueries.runSteps(runId ?? ""), enabled: runId !== null });
  return query.data ?? NO_STEPS;
}
