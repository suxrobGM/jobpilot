"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { PipelineColumnPage, PipelineStage } from "@/types/api/pipeline";
import { buildUrl } from "@/utils/url";

export interface PipelineColumnFilters {
  search?: string;
  board?: string;
  matchMin?: number;
}

const DEFAULT_LIMIT = 50;

export function usePipelineColumn(stage: PipelineStage, filters: PipelineColumnFilters = {}) {
  return useInfiniteQuery<
    PipelineColumnPage,
    Error,
    InfiniteData<PipelineColumnPage>,
    ReturnType<typeof queryKeys.pipeline.column>,
    string | null
  >({
    queryKey: queryKeys.pipeline.column(stage, filters as Record<string, unknown>),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.get<PipelineColumnPage>(
        buildUrl("/api/pipeline", {
          stage,
          limit: DEFAULT_LIMIT,
          cursor: pageParam,
          search: filters.search,
          board: filters.board,
          matchMin: filters.matchMin,
        }),
      );
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to load pipeline column");
      }
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
