import { jobListingStatusSchema } from "@jobpilot/contracts/job-listing";
import { paginatedSchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

/** Board and link only, never who found it. */
const jobListingSourceSchema = z.object({
  /** The board's display name ("LinkedIn"), or its domain when the catalog row is unlisted. */
  board: z.string().nullable(),
  url: z.string(),
  lastSeenAt: z.date(),
});

/** The privacy contract: no userId, campaignId, matchScore or appliedAt may ever appear here. */
const jobListingSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  remote: z.boolean(),
  salary: z.string().nullable(),
  employmentType: z.string().nullable(),
  skills: z.array(z.string()),
  descriptionExcerpt: z.string().nullable(),
  firstSeenAt: z.date(),
  lastSeenAt: z.date(),
  /** How many source links were merged into this listing. Reposts count, so this is not boards. */
  sourceCount: z.number().int(),
  /** Distinct board names, most recently seen first. */
  boards: z.array(z.string()),
});

export const jobListingSchema = jobListingSummarySchema.extend({
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  yearsExperience: z.number().int().nullable(),
  sources: z.array(jobListingSourceSchema),
});

export const jobListingPageSchema = paginatedSchema(jobListingSummarySchema);

/** Bounded at six, so a bare array. */
export const similarJobListingsSchema = z.array(jobListingSummarySchema);

/** Only skills the index holds, so the `?skills=` filter never offers an option with no results. */
export const jobListingFacetsSchema = z.object({
  skills: z.array(z.object({ value: z.string(), count: z.number().int() })),
});

export const jobListingSitemapSchema = z.array(
  z.object({ slug: z.string(), lastSeenAt: z.date() }),
);

export const adminJobListingSchema = jobListingSummarySchema.extend({
  status: jobListingStatusSchema,
});

export const adminJobListingPageSchema = paginatedSchema(adminJobListingSchema);
