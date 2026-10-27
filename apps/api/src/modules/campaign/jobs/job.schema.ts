import { statusSchema } from "@jobpilot/contracts/application";
import {
  campaignJobReasonSchema,
  campaignJobSchema,
  campaignJobStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { paginatedSchema, paginationQuerySchema, queryText } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const campaignJobParams = z.object({ id: z.uuid(), key: z.string() });

/** Applied server-side so a page reflects the whole campaign, not one page of it. */
export const campaignJobsQuery = paginationQuerySchema.extend({
  status: campaignJobStatusSchema.optional(),
  search: queryText.optional(),
});

export const campaignJobListSchema = paginatedSchema(campaignJobSchema);

export const campaignJobReasonListSchema = z.array(campaignJobReasonSchema);

// Not `applicationSchema`: the application module imports this file, and the cycle would break load order.
const campaignApplicationSchema = z.object({
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
  rejectedAt: z.date().nullable(),
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  failReason: z.string().nullable(),
  campaignId: z.string().nullable(),
});

/** `application` is null unless the outcome was `applied`. */
export const campaignJobResultResponseSchema = z.object({
  campaignJob: campaignJobSchema,
  application: campaignApplicationSchema.nullable(),
  summary: campaignSummarySchema,
});
