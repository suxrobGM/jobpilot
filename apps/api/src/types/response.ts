import { z } from "zod/v4";

// ── Error envelope ────────────────────────────────────────────────────────────

/**
 * Standard error envelope produced by the global error middleware
 * (`{ code, message, details? }`). `code` is a stable string the web client and
 * the agent's skills read. Used as the `response` schema for non-2xx statuses so
 * error shapes show up in Swagger.
 */
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * The standard error statuses this API emits, each mapped to the shared error
 * envelope. Applied once via a `.guard({ response })` on the `/api` group so
 * every route documents these in Swagger and Eden Treaty; routes only declare
 * their own 200 success schema.
 */
export const httpErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
} as const;

// ── Common success envelopes ──────────────────────────────────────────────────

/** `{ id }` — returned by most create/update routes. */
export const idResponseSchema = z.object({ id: z.uuid() });

/** `{ deleted }` — returned by delete routes that echo the removed id. */
export const deletedResponseSchema = z.object({ deleted: z.uuid() });

/** `{ ok: true }` — generic acknowledgement (failures throw the error envelope). */
export const okResponseSchema = z.object({ ok: z.literal(true) });

/** `{ message }` — message-only acknowledgement. */
export const messageResponseSchema = z.object({ message: z.string() });

// ── Pagination ────────────────────────────────────────────────────────────────

/** Page metadata returned alongside a paginated collection. */
export const paginationSchema = z.object({
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
export const paginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), pagination: paginationSchema });

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

/** Assemble a paginated response, deriving `totalPages` from `total`/`limit`. */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: Omit<Pagination, "totalPages">,
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      ...pagination,
      totalPages: pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0,
    },
  };
}
