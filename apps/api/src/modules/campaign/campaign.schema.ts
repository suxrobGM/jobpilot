import {
  campaignActorSchema,
  campaignConfigSchema,
  campaignJobStatusSchema,
  campaignSourceSchema,
  campaignStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { csvArray, paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const campaignParams = z.object({ id: z.uuid() });
export const campaignJobParams = z.object({ id: z.uuid(), key: z.string() });
export const networkingMessageParams = z.object({ id: z.uuid(), messageId: z.uuid() });

export const campaignsQuery = paginationQuerySchema.extend({
  // The workspace pages Active (in_progress+paused) and Completed as two separate lists.
  status: csvArray(campaignStatusSchema).optional(),
  source: campaignSourceSchema.optional(),
  // "Still has work of this kind", in SQL: a caller filtering its page only sees that page.
  jobStatus: campaignJobStatusSchema.optional(),
});

/** Jobs list filters. Applied server-side so a page reflects the whole campaign, not one page of it. */
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
  failReason: z.string().nullable(),
  retryNotes: z.string().nullable(),
  skipReason: z.string().nullable(),
  description: z.string().nullable(),
  digest: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const campaignSchema = z.object({
  campaignId: z.uuid(),
  userId: z.uuid(),
  query: z.string(),
  source: campaignSourceSchema,
  status: campaignStatusSchema,
  createdBy: campaignActorSchema,
  statusActor: campaignActorSchema.nullable(),
  statusReason: z.string().nullable(),
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  config: campaignConfigSchema,
  summary: campaignSummarySchema,
});

export const campaignListSchema = paginatedSchema(campaignSchema);
export const campaignDeletedSchema = z.object({ deleted: z.boolean(), campaignId: z.uuid() });
