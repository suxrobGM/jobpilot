"use client";

import { api } from "@/api/client";
import { type ApiMutationResult, useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";

/** The base resume new campaigns, tailoring and onboarding fall back to. */
export function useSetPrimaryResume(): ApiMutationResult<unknown, string> {
  return useApiMutation((resumeId: string) => api.user["primary-resume"].put({ resumeId }), {
    successMessage: "Primary resume updated",
    invalidate: invalidations.resume,
  });
}
