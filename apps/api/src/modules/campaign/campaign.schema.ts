import {
  campaignConfigSchema,
  campaignJobStatusSchema,
  campaignSourceSchema,
  campaignStatusSchema,
  campaignSummarySchema,
} from "@jobpilot/contracts/campaign";
import { z } from "zod/v4";

export const campaignParams = z.object({ id: z.string() });
export const campaignJobParams = z.object({ id: z.string(), key: z.string() });

export const outreachMessageParams = z.object({
  id: z.string(),
  messageId: z.uuid(),
});

export const campaignsQuery = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

/**
 * A campaign job row (mirrors the service's `CampaignJobRow`). `status` is the
 * job-status union and `appliedAt` is serialized to ISO, but `createdAt` is the
 * raw Prisma `Date` (the mapper spreads it through without stringifying).
 */
export const campaignJobSchema = z.object({
  id: z.uuid(),
  campaignId: z.string(),
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
});

/** A campaign row with `config`/`summary` parsed and dates serialized (mirrors `CampaignRow`). */
export const campaignSchema = z.object({
  campaignId: z.string(),
  profileId: z.uuid(),
  query: z.string(),
  source: campaignSourceSchema,
  status: campaignStatusSchema,
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  config: campaignConfigSchema,
  summary: campaignSummarySchema,
});

/** A list of campaigns (the `list` route). */
export const campaignListSchema = z.array(campaignSchema);

/**
 * Result of creating a campaign — the raw created row with dates serialized but
 * `config`/`summary` left as the stored JSON strings (the service does not parse
 * them on create).
 */
export const campaignCreatedSchema = z.object({
  campaignId: z.string(),
  profileId: z.uuid(),
  query: z.string(),
  source: campaignSourceSchema,
  status: campaignStatusSchema,
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  config: z.string(),
  summary: z.string(),
});

/** A single campaign with its jobs and derived summary (the `get` route). */
export const campaignWithJobsSchema = campaignSchema.extend({
  jobs: z.array(campaignJobSchema),
});

/** Result of deleting a campaign — `deleted` flag plus the removed campaign id. */
export const campaignDeletedSchema = z.object({
  deleted: z.boolean(),
  campaignId: z.string(),
});
