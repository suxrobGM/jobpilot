import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginationQuery,
} from "@jobpilot/contracts/pagination";

type Param = string | string[] | undefined;

/** First value of a repeated query param (`?tech=a&tech=b`). */
export function one(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `?page=` as a 1-based page number. Anything junk, negative, or absent reads as page 1. Pass the
 * endpoint's cap to clamp: past it the API 422s, and the page renders its "unavailable" state.
 */
export function pageParam(value: Param, max = Number.POSITIVE_INFINITY): number {
  const parsed = Number(one(value));
  if (!Number.isFinite(parsed) || parsed <= 1) {
    return 1;
  }
  return Math.min(Math.floor(parsed), max);
}

/** `?pageSize=` clamped to what the API accepts; anything junk or absent reads as the default. */
export function pageSizeParam(value: Param, fallback = DEFAULT_PAGE_SIZE): number {
  const parsed = Number(one(value));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

/** The paging half of an RSC page's `searchParams`; intersect it with the route's own filters. */
export interface PaginationSearchParams {
  page?: string;
  pageSize?: string;
}

/** An RSC page's `?page=`/`?pageSize=` as the query a paginated route takes. */
export function paginationQuery(params: PaginationSearchParams): PaginationQuery {
  return { page: pageParam(params.page), limit: pageSizeParam(params.pageSize) };
}

/** A `?key=` value narrowed to an enum, or null when absent or hand-edited to junk. */
export function enumParam<T extends string>(values: readonly T[], raw: string | null): T | null {
  return values.find((value) => value === raw) ?? null;
}
