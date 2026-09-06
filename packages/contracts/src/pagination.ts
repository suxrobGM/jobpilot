import { z } from "zod/v4";

/**
 * The one pagination model, shared by the API, the web app and the agent's skills.
 *
 * Two access modes, and they are not interchangeable:
 * - **offset** (`page`/`limit`) - every browsable list.
 * - **cursor** (`cursor`/`nextCursor`) - append-only live feeds only. Offset drifts on a feed
 *   that grows at the head: the pilot journal prepends entries while the orchestrator runs, so
 *   by the time page 2 is asked for at offset 50, N new rows have shifted everything down - N
 *   rows are served twice and N are never served. It is also the only per-user table that grows
 *   without bound, so offset would add a `count()` to every page load.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** The page sizes the web's rows-per-page selector offers. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** The page/limit query every paginated list route accepts; extend it with the route's filters. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * A repeatable list filter (`?status=a,b`). It reaches the handler as a comma-joined string on
 * some paths and an already-split array on others, so normalize before the array parse.
 */
export const csvArray = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => (typeof value === "string" ? value.split(",") : value), z.array(item));

/** Page metadata returned alongside a paginated collection. */
const paginationSchema = z.object({
  /** Current page number, starting from 1. */
  page: z.number().int(),
  /** Number of items per page. */
  limit: z.number().int(),
  /** Total number of items across all pages. */
  total: z.number().int(),
  /** Total number of pages. */
  totalPages: z.number().int(),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Build a `{ items, pagination }` response schema for a given item schema. */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), pagination: paginationSchema });

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

/** Prisma `skip`/`take` for a page - the one place the offset arithmetic lives. */
export function pageSlice(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

/** Assemble a paginated response, deriving `totalPages` from `total`/`limit`. */
export function paginate<T>(items: T[], query: PaginationQuery, total: number): Paginated<T> {
  const { page, limit } = query;
  return {
    items,
    pagination: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

// Cursor pagination (append-only feeds)

export const DEFAULT_CURSOR_PAGE_SIZE = 50;

/** The cursor query for an append-only feed; extend it with the feed's filters. */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_CURSOR_PAGE_SIZE),
});

/** Build an `{ items, nextCursor }` response schema for a given item schema. */
export const cursorPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Trim a batch fetched with `take: limit + 1` into a page plus the cursor to resume from.
 * The extra row is what proves more exist, so `nextCursor` is null exactly at the end.
 */
export function cursorPage<T extends { id: string }>(rows: T[], limit: number): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}
