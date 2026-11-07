"use client";

import type { ApplicationStatus } from "@jobpilot/contracts/application";
import type { PipelineFilters } from "@jobpilot/contracts/pipeline";
import { useSearchParams } from "next/navigation";
import { enumParam } from "@/utils/search-params";

// The funnel: rejected and withdrawn applications only show under All.
export const FUNNEL = [
  "applied",
  "screening",
  "interviewing",
  "offer",
] as const satisfies ApplicationStatus[];

export function usePipelineFilters(): PipelineFilters {
  const params = useSearchParams();
  const feedId = params.get("feed");
  const board = params.get("board");
  const search = params.get("q");
  return {
    ...(feedId && { feedId }),
    ...(board && { board }),
    ...(search && { search }),
  };
}

export function useFunnelStatus(): ApplicationStatus | null {
  return enumParam(FUNNEL, useSearchParams().get("status"));
}
