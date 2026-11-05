"use client";

import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { api } from "@/api/client";
import { type ApiMutationResult, useApiMutation } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import type { JobBoardDto } from "@/api/types";

interface LinkBoardOptions {
  successMessage?: string;
  onSuccess?: (board: JobBoardDto) => void;
}

/** Links a board to the profile. Shared by the Boards page dialog and the campaign composer. */
export function useLinkBoard(
  options?: LinkBoardOptions,
): ApiMutationResult<JobBoardDto, JobBoardInput> {
  return useApiMutation((body: JobBoardInput) => api["job-boards"].post(body), {
    invalidate: [jobBoardQueries.all],
    ...options,
  });
}
