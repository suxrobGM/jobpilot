import {
  campaignConfigSchema,
  campaignJobStatusSchema,
  campaignSourceSchema,
  campaignStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { z } from "zod/v4";
import { paginatedResponseSchema } from "@/types/response";

export const campaignParams = z.object({ id: z.uuid() });
export const campaignJobParams = z.object({ id: z.uuid(), key: z.string() });
export const networkingMessageParams = z.object({ id: z.uuid(), messageId: z.uuid() });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const campaignsQuery = paginationQuery.extend({
  status: campaignStatusSchema.optional(),
  source: campaignSourceSchema.optional(),
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
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  config: campaignConfigSchema,
  summary: campaignSummarySchema,
});

export const campaignListSchema = paginatedResponseSchema(campaignSchema);
export const campaignDeletedSchema = z.object({ deleted: z.boolean(), campaignId: z.uuid() });
