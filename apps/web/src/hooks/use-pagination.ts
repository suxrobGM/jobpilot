"use client";

import { useState } from "react";

export interface Pagination<T> {
  /** Current page, clamped to a valid range (1-based). */
  page: number;
  setPage: (page: number) => void;
  /** Total number of pages (at least 1). */
  pageCount: number;
  /** The slice of `items` for the current page. */
  pageRows: T[];
  /** Total number of items before paging. */
  total: number;
}

/**
 * Client-side pagination over an in-memory list. Pair with {@link PaginationFooter}.
 * The returned `page` is clamped to the valid range, so shrinking the list
 * (e.g. applying a filter) never strands the view on an empty page.
 */
export function usePagination<T>(items: readonly T[], pageSize: number): Pagination<T> {
  const [page, setPage] = useState(1);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { page: safePage, setPage, pageCount, pageRows, total };
}
