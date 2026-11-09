import type { PilotStep } from "@jobpilot/contracts/pilot";
import type { Jsonified } from "@jobpilot/contracts/sse";
import type { QueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

/** Matches the API's per-run cap. */
const STEPS_KEPT = 100;

/** Appends streamed steps to a run already in the cache; a run nobody watches fetches on open. */
export function appendRunSteps(
  queryClient: QueryClient,
  runId: string,
  streamed: Jsonified<PilotStep>[],
): void {
  if (streamed.length === 0) {
    return;
  }
  const steps = streamed.map((step) => ({ ...step, at: new Date(step.at) }));
  queryClient.setQueryData<PilotStep[]>(pilotQueries.runSteps(runId).queryKey, (current) =>
    // Ids restart if the API restarts mid-run; the newer steps win.
    current
      ? [...current.filter((step) => step.id < steps[0].id), ...steps].slice(-STEPS_KEPT)
      : current,
  );
}
