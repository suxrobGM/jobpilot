import {
  portfolioProjectSchema,
  screeningAnswerSchema,
  UPWORK_PROFILE_STATUSES,
  UPWORK_PROPOSAL_OUTCOMES,
  UPWORK_PROPOSAL_SOURCES,
  UPWORK_PROPOSAL_STATUSES,
} from "@jobpilot/contracts/upwork";
import { z } from "zod/v4";

export const proposalsQuery = z.object({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

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
  suggestedTitle: z.string().nullable(),
  suggestedOverview: z.string().nullable(),
  suggestedHourlyRate: z.string().nullable(),
  suggestedPortfolio: z.array(portfolioProjectSchema),
  status: z.enum(UPWORK_PROFILE_STATUSES),
  updatedAt: z.date(),
  appliedAt: z.date().nullable(),
});

export const upworkProfileResponseSchema = upworkProfileSchema.nullable();

/** A single proposal with decoded screening answers (`decodeUpworkProposal`). */
export const upworkProposalSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
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

export const upworkProposalListSchema = z.array(upworkProposalSchema);
