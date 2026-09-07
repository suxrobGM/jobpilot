import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import {
  portfolioProjectSchema,
  screeningAnswerSchema,
  UPWORK_INBOX_KINDS,
  UPWORK_INBOX_STATUSES,
  UPWORK_PROFILE_STATUSES,
  UPWORK_PROPOSAL_OUTCOMES,
  UPWORK_PROPOSAL_SOURCES,
  UPWORK_PROPOSAL_STATUSES,
} from "@jobpilot/contracts/upwork";
import { z } from "zod/v4";

export const proposalsQuery = paginationQuerySchema.extend({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

/** Deterministic client/job quality assessment result (`scoreUpworkClient`). */
export const upworkQualityResultSchema = z.object({
  qualityScore: z.number(),
  verdict: z.enum(["good", "caution", "skip"]),
  flags: z.array(z.string()),
  skipReason: z.string().nullable(),
});

/** Profile-enhancement record (`toUpworkProfileDto`); null when none exists yet. */
export const upworkProfileSchema = z.object({
  id: z.uuid(),
  currentTitle: z.string().nullable(),
  currentOverview: z.string().nullable(),
  currentHourlyRate: z.string().nullable(),
  currentPortfolio: z.array(portfolioProjectSchema),
  currentSkills: z.array(z.string()),
  suggestedTitle: z.string().nullable(),
  suggestedOverview: z.string().nullable(),
  suggestedHourlyRate: z.string().nullable(),
  suggestedPortfolio: z.array(portfolioProjectSchema),
  suggestedSkills: z.array(z.string()),
  status: z.enum(UPWORK_PROFILE_STATUSES),
  updatedAt: z.date(),
  appliedAt: z.date().nullable(),
});

export const upworkProfileResponseSchema = upworkProfileSchema.nullable();

/** A single proposal with decoded screening answers (`decodeUpworkProposal`). */
export const upworkProposalSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  jobTitle: z.string(),
  clientName: z.string().nullable(),
  jobUrl: z.string().nullable(),
  jobDescription: z.string().nullable(),
  proposalText: z.string(),
  screeningAnswers: z.array(screeningAnswerSchema),
  status: z.enum(UPWORK_PROPOSAL_STATUSES),
  outcome: z.enum(UPWORK_PROPOSAL_OUTCOMES).nullable(),
  notes: z.string().nullable(),
  source: z.enum(UPWORK_PROPOSAL_SOURCES),
  campaignId: z.string().nullable(),
  jobKey: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  submittedAt: z.date().nullable(),
});

export const upworkProposalListSchema = paginatedSchema(upworkProposalSchema);

/** Account snapshot the sync skill maintains; null until the first sync. */
export const upworkAccountSchema = z.object({
  id: z.uuid(),
  connectsBalance: z.number().int().nullable(),
  lastSyncedAt: z.date().nullable(),
  updatedAt: z.date(),
});

export const upworkAccountResponseSchema = upworkAccountSchema.nullable();

export const inboxQuery = paginationQuerySchema.extend({
  kind: z.enum(UPWORK_INBOX_KINDS).optional(),
  status: z.enum(UPWORK_INBOX_STATUSES).optional(),
});

/** One mirrored invitation, offer, or message thread (`toUpworkInboxItemDto`). */
export const upworkInboxItemSchema = z.object({
  id: z.uuid(),
  upworkId: z.string(),
  kind: z.enum(UPWORK_INBOX_KINDS),
  title: z.string(),
  clientName: z.string().nullable(),
  jobUrl: z.string().nullable(),
  body: z.string().nullable(),
  status: z.enum(UPWORK_INBOX_STATUSES),
  receivedAt: z.date(),
  raw: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const upworkInboxListSchema = paginatedSchema(upworkInboxItemSchema);

/** How many rows a sync created versus refreshed. */
export const upworkInboxSyncResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
});
