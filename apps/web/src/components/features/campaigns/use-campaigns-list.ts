"use client";

import type { CampaignSource, CampaignStatus } from "@jobpilot/contracts/campaign";
import { useState } from "react";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto } from "@/api/types";
import { usePagination, type Pagination } from "@/hooks/use-pagination";

export interface UseCampaignsListResult {
  statusFilter: CampaignStatus | null;
  setStatusFilter: (next: CampaignStatus | null) => void;
  sourceFilter: CampaignSource | null;
  setSourceFilter: (next: CampaignSource | null) => void;
  hasFilters: boolean;
  resetFilters: () => void;
  allRows: CampaignDto[];
  filteredRows: CampaignDto[];
  interruptedCount: number;
  isLoading: boolean;
  pagination: Pagination<CampaignDto>;
}

/**
 * Campaigns list state: status/source filtering over the cached campaigns query, the
 * interrupted-campaign count, and client-side pagination. Consumed by the pipeline
 * Campaigns rail. SSE invalidation lives with the page-level subscription, not here.
 */
export function useCampaignsList(pageSize: number): UseCampaignsListResult {
  const [statusFilter, setStatusFilterState] = useState<CampaignStatus | null>(null);
  const [sourceFilter, setSourceFilterState] = useState<CampaignSource | null>(null);

  const campaigns = useApiQuery<CampaignDto[]>(queryKeys.campaigns.list(), () =>
    api.campaigns.get(),
  );

  const allRows = campaigns.data ?? [];
  const interruptedCount = allRows.filter((r) => r.status === "interrupted").length;

  const filteredRows = allRows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) {
      return false;
    }
    if (sourceFilter && r.source !== sourceFilter) {
      return false;
    }
    return true;
  });

  const pagination = usePagination(filteredRows, pageSize);

  const setStatusFilter = (next: CampaignStatus | null): void => {
    setStatusFilterState(next);
    pagination.setPage(1);
  };

  const setSourceFilter = (next: CampaignSource | null): void => {
    setSourceFilterState(next);
    pagination.setPage(1);
  };

  const resetFilters = (): void => {
    setStatusFilterState(null);
    setSourceFilterState(null);
    pagination.setPage(1);
  };

  return {
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    hasFilters: statusFilter !== null || sourceFilter !== null,
    resetFilters,
    allRows,
    filteredRows,
    interruptedCount,
    isLoading: campaigns.isLoading,
    pagination,
  };
}
