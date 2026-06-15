"use client";

import { useSearchParam } from "@/hooks/use-search-param";
import type { PipelineColumnFilters } from "./use-pipeline-column";

export interface PipelineFiltersValue {
  search: string | null;
  setSearch: (next: string | null) => void;
  board: string | null;
  setBoard: (next: string | null) => void;
  /** Selected campaign scoping the board, or null for the whole pipeline. */
  campaignId: string | null;
  setCampaignId: (next: string | null) => void;
  filters: PipelineColumnFilters;
  isAnyActive: boolean;
  clearAll: () => void;
}

export function usePipelineFilters(): PipelineFiltersValue {
  const [search, setSearch] = useSearchParam("search");
  const [board, setBoard] = useSearchParam("board");
  const [campaignId, setCampaignId] = useSearchParam("campaignId");

  const filters: PipelineColumnFilters = { search, board, campaignId };
  const isAnyActive = search !== null || board !== null || campaignId !== null;

  const clearAll = (): void => {
    setSearch(null);
    setBoard(null);
    setCampaignId(null);
  };

  return {
    search,
    setSearch,
    board,
    setBoard,
    campaignId,
    setCampaignId,
    filters,
    isAnyActive,
    clearAll,
  };
}
