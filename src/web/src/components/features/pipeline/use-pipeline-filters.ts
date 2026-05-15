"use client";

import { useSearchParam, useSearchParamNumber } from "@/hooks/use-search-param";
import type { PipelineColumnFilters } from "./use-pipeline-column";

export interface PipelineFiltersValue {
  search: string | null;
  setSearch: (next: string | null) => void;
  board: string | null;
  setBoard: (next: string | null) => void;
  matchMin: number | null;
  setMatchMin: (next: number | null) => void;
  filters: PipelineColumnFilters;
  isAnyActive: boolean;
  clearAll: () => void;
}

export function usePipelineFilters(): PipelineFiltersValue {
  const [search, setSearch] = useSearchParam("search");
  const [board, setBoard] = useSearchParam("board");
  const [matchMin, setMatchMin] = useSearchParamNumber("matchMin");

  const filters: PipelineColumnFilters = { search, board, matchMin };
  const isAnyActive = search !== null || board !== null || matchMin !== null;

  const clearAll = (): void => {
    setSearch(null);
    setBoard(null);
    setMatchMin(null);
  };

  return {
    search,
    setSearch,
    board,
    setBoard,
    matchMin,
    setMatchMin,
    filters,
    isAnyActive,
    clearAll,
  };
}
