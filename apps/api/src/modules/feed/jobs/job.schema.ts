import { statusSchema } from "@jobpilot/contracts/application";
import { jobReasonSchema, jobSchema, jobStatusSchema } from "@jobpilot/contracts/feed";
import { paginatedSchema, paginationQuerySchema, queryText } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const jobParams = z.object({ id: z.uuid(), key: z.string() });

/** Applied server-side so a page reflects the whole feed, not one page of it. */
export const jobsQuery = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
  search: queryText.optional(),
});

export const jobListSchema = paginatedSchema(jobSchema);

export const jobReasonListSchema = z.array(jobReasonSchema);

// Not `applicationSchema`: the application module imports this file, and the cycle would break load order.
const feedApplicationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  boardId: z.uuid().nullable(),
  source: z.string(),
  appliedAt: z.date(),
  status: statusSchema,
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  feedId: z.string().nullable(),
});

/** `application` is null unless the outcome was `applied`. */
export const jobResultResponseSchema = z.object({
  job: jobSchema,
  application: feedApplicationSchema.nullable(),
});
