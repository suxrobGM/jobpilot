import {
  actorSchema,
  campaignConfigSchema,
  campaignJobStatusSchema,
  campaignSourceSchema,
  campaignStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { boardRefSchema } from "@jobpilot/contracts/job-board";
import { csvArray, paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const campaignsQuery = paginationQuerySchema.extend({
  // The workspace pages Active (in_progress+paused) and Completed as two separate lists.
  status: csvArray(campaignStatusSchema).optional(),
  source: campaignSourceSchema.optional(),
  // "Still has work of this kind", in SQL: a caller filtering its page only sees that page.
  jobStatus: campaignJobStatusSchema.optional(),
});

export const campaignSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  query: z.string(),
  source: campaignSourceSchema,
  status: campaignStatusSchema,
  createdBy: actorSchema,
  statusChangedBy: actorSchema.nullable(),
  statusReason: z.string().nullable(),
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  board: boardRefSchema.nullable(),
  config: campaignConfigSchema,
  summary: campaignSummarySchema,
});

export const campaignListSchema = paginatedSchema(campaignSchema);

export const campaignAccountSummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  replies: z.number().int(),
  drafts: z.object({
    messages: z.number().int(),
    campaigns: z.number().int(),
    /** Set only when exactly one campaign holds drafts, so the dashboard can link straight to it. */
    campaignId: z.uuid().nullable(),
  }),
});
