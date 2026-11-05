"use client";

import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";

/** Autopilot gates only the pilot's own work; requests and chat run either way. */
export function useAutopilot() {
  return useApiMutation((on: boolean) => api.pilot.autopilot.put({ on }), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: (_state, on) => (on ? "Autopilot on." : "Autopilot paused."),
  });
}
