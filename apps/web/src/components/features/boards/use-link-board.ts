"use client";

import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { api } from "@/api/client";
import { jobBoardQueries } from "@/api/queries";
import type { JobBoardDto } from "@/api/types";
import { type ApiMutationResult, useApiMutation } from "@/api/use-api-mutation";

interface LinkBoardOptions {
  successMessage?: string;
  onSuccess?: (board: JobBoardDto) => void;
}

/** Links a board to the profile. Used by the add-board dialog. */
export function useLinkBoard(
  options?: LinkBoardOptions,
): ApiMutationResult<JobBoardDto, JobBoardInput> {
  return useApiMutation((body: JobBoardInput) => api["job-boards"].post(body), {
    invalidate: [jobBoardQueries.all],
    ...options,
  });
}
