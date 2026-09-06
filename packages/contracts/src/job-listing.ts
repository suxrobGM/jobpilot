import { z } from "zod/v4";
import { paginationQuerySchema } from "./pagination";

const JOB_LISTING_STATUSES = ["published", "hidden"] as const;
export const jobListingStatusSchema = z.enum(JOB_LISTING_STATUSES);

/** Capped: a crawler will happily follow /jobs?page=50000 into an unbounded OFFSET scan. */
export const JOB_LISTING_MAX_PAGE = 500;

/** The `?tech=` wire format lives here, so the web, the API and the URL cannot disagree on it. */
export function parseTechParam(value: string | string[] | null | undefined): string[] {
  const entries = Array.isArray(value) ? value : (value ?? "").split(",");
  return entries.map((entry) => entry.trim()).filter(Boolean);
}

export function serializeTechParam(values: string[]): string {
  return values.join(",");
}

/** Public /jobs filters. Every param is crawlable as a query string, so all are optional. */
export const jobListingQuerySchema = paginationQuerySchema.extend({
  // Only `page` is re-declared: the crawler cap above is specific to this route.
  page: z.coerce.number().int().min(1).max(JOB_LISTING_MAX_PAGE).default(1),
  /** Free text over title + company. */
  q: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  remote: z.stringbool().optional(),
  board: z.string().trim().min(1).optional(),
  /**
   * Tech entries; a listing matches if it has ANY of them. Accepts both shapes because Elysia's
   * query parser already splits `?tech=React,TypeScript` into an array but hands a lone value
   * through as a string.
   */
  tech: z
    .union([z.string(), z.array(z.string())])
    .transform(parseTechParam)
    .optional(),
});

/**
 * The filter params, minus pagination - the web reads these off the URL and the pager preserves
 * them. Derived from the schema so a new filter cannot be added here and forgotten there.
 */
export const JOB_LISTING_FILTER_KEYS = Object.keys(jobListingQuerySchema.shape).filter(
  (key) => key !== "page" && key !== "limit",
) as Exclude<keyof JobListingQuery, "page" | "limit">[];

/** Admin moderation list - the one caller allowed to see hidden rows. */
export const adminJobListingQuerySchema = jobListingQuerySchema.extend({
  status: jobListingStatusSchema.optional(),
});

export const adminJobListingPatchSchema = z.object({
  status: jobListingStatusSchema,
});

export type JobListingStatus = z.infer<typeof jobListingStatusSchema>;
export type JobListingQuery = z.infer<typeof jobListingQuerySchema>;
export type AdminJobListingQuery = z.infer<typeof adminJobListingQuerySchema>;
export type AdminJobListingPatch = z.infer<typeof adminJobListingPatchSchema>;
