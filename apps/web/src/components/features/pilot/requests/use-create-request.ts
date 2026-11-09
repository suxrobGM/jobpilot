"use client";

import type { CreatePilotRequestInput } from "@jobpilot/contracts/pilot";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";

interface CreateRequestOptions {
  onSuccess?: () => void;
}

/** Asks the pilot for work by name; it runs on the user's agent ahead of autonomous work. */
export function useCreateRequest(options: CreateRequestOptions = {}) {
  return useApiMutation(
    (input: CreatePilotRequestInput) => api.pilot.requests.post({ ...input, source: "web" }),
    {
      invalidate: [pilotQueries.threadAll],
      successMessage: "Asked the pilot. Follow along on the Pilot page.",
      onSuccess: options.onSuccess,
    },
  );
}
