"use client";

import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import { type ApiMutationResult, useApiMutation } from "@/api/use-api-mutation";

/** The base resume new feeds, tailoring and onboarding fall back to. */
export function useSetPrimaryResume(): ApiMutationResult<unknown, string> {
  return useApiMutation((resumeId: string) => api.user["primary-resume"].put({ resumeId }), {
    successMessage: "Primary resume updated",
    invalidate: invalidations.resume,
  });
}
