"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/api/client";
import { apiErrorMessage } from "@/api/error";
import { queryKeys } from "@/api/query-keys";
import type { PipelineColumnPage, PipelineStage } from "@/api/types/pipeline";

export interface PipelineColumnFilters {
  search: string | null;
  board: string | null;
  campaignId: string | null;
}

const DEFAULT_LIMIT = 50;

const EMPTY_FILTERS: PipelineColumnFilters = { search: null, board: null, campaignId: null };

export function usePipelineColumn(
  stage: PipelineStage,
  filters: PipelineColumnFilters = EMPTY_FILTERS,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery<
    PipelineColumnPage,
    Error,
    InfiniteData<PipelineColumnPage>,
    ReturnType<typeof queryKeys.pipeline.column>,
    string | null
  >({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.pipeline.column(stage, filters),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.pipeline.get({
        query: {
          stage,
          limit: DEFAULT_LIMIT,
          cursor: pageParam,
          ...filters,
        },
      });
      if (error || !data) {
        throw new Error(apiErrorMessage(error, "Failed to load pipeline column"));
      }
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
