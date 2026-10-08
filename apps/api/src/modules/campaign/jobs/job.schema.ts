import { statusSchema } from "@jobpilot/contracts/application";
import {
  campaignJobReasonSchema,
  campaignJobStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const campaignJobParams = z.object({ id: z.uuid(), key: z.string() });

/** Applied server-side so a page reflects the whole campaign, not one page of it. */
export const campaignJobsQuery = paginationQuerySchema.extend({
  status: campaignJobStatusSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export const campaignJobSchema = z.object({
  id: z.uuid(),
  campaignId: z.uuid(),
  key: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  type: z.string().nullable(),
  url: z.string(),
  board: z.string().nullable(),
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  status: campaignJobStatusSchema,
  appliedAt: z.date().nullable(),
  submitAttemptedAt: z.date().nullable(),
  failReason: z.string().nullable(),
  retryNotes: z.string().nullable(),
  skipReason: z.string().nullable(),
  description: z.string().nullable(),
  brief: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
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
  board: z.string().nullable(),
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
