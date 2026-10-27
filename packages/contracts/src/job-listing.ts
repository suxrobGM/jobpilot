import { z } from "zod/v4";
import { paginationQuerySchema, queryText } from "./pagination";

export const JOB_LISTING_STATUSES = ["published", "hidden"] as const;
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

/** `recent` orders by last sighting, `newest` by first. */
const JOB_LISTING_SORTS = ["recent", "newest"] as const;
export const jobListingSortSchema = z.enum(JOB_LISTING_SORTS);

/** `?posted=` windows over `firstSeenAt`, keyed by their URL value. */
export const JOB_LISTING_POSTED_WITHIN = { "24h": 1, "7d": 7, "30d": 30 } as const;
export const jobListingPostedSchema = z.enum(
  Object.keys(JOB_LISTING_POSTED_WITHIN) as [keyof typeof JOB_LISTING_POSTED_WITHIN],
);

/** All optional: every filter is a crawlable query string. */
export const jobListingQuerySchema = paginationQuerySchema.extend({
  // Only `page` is re-declared: the crawler cap above is specific to this route.
  page: z.coerce.number().int().min(1).max(JOB_LISTING_MAX_PAGE).default(1),
  /** Free text over title + company. */
  q: queryText.optional(),
  location: queryText.optional(),
  remote: z.stringbool().optional(),
  board: z.string().trim().min(1).optional(),
  /**
   * A listing matches ANY entry. Both shapes, because Elysia splits `?tech=React,TypeScript`
   * into an array but passes a lone value through as a string.
   */
  tech: z
    .union([z.string(), z.array(z.string())])
    .transform(parseTechParam)
    .optional(),
  sort: jobListingSortSchema.optional(),
  posted: jobListingPostedSchema.optional(),
});

/** Derived from the schema so a new filter can't be added there and forgotten here. */
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
export type JobListingSort = z.infer<typeof jobListingSortSchema>;
export type JobListingPosted = z.infer<typeof jobListingPostedSchema>;
export type AdminJobListingQuery = z.infer<typeof adminJobListingQuerySchema>;
export type AdminJobListingPatch = z.infer<typeof adminJobListingPatchSchema>;
