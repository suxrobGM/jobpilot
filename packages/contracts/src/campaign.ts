import { z } from "zod/v4";
import { networkingConfigSchema } from "./networking";
import { cleanReplacementChars } from "./utils/text";

/** A free-text string with mangled replacement-char artifacts cleaned on write. */
const reasonText = z.string().transform(cleanReplacementChars);

export const CAMPAIGN_STATUSES = ["in_progress", "paused", "completed", "failed"] as const;
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);

export const CAMPAIGN_SOURCES = ["search", "auto-apply", "apply", "networking"] as const;
export const campaignSourceSchema = z.enum(CAMPAIGN_SOURCES);

export const CAMPAIGN_JOB_STATUSES = [
  "pending",
  "approved",
  "applying",
  "applied",
  "failed",
  "skipped",
  // Parked by the Pilot mid-apply pending a user answer (see Question); non-terminal.
  "needs_user",
] as const;
export const campaignJobStatusSchema = z.enum(CAMPAIGN_JOB_STATUSES);

export const campaignConfigSchema = z.object({
  board: z.string().min(1).optional(),
  resumeId: z.uuid().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  maxApplications: z.number().int().min(1).max(500).optional(),
  // No upper cap: absent = unlimited (search runs until the board is exhausted).
  maxJobs: z.number().int().min(1).optional(),
  networking: networkingConfigSchema.optional(),
});

export const campaignJobSummarySchema = z.object({
  kind: z.literal("jobs"),
  totalFound: z.number().int().min(0).default(0),
  qualified: z.number().int().min(0).default(0),
  applied: z.number().int().min(0).default(0),
  failed: z.number().int().min(0).default(0),
  skipped: z.number().int().min(0).default(0),
  remaining: z.number().int().min(0).default(0),
  /** Per-status totals across every job, not just a loaded page - the funnel reads these. */
  byStatus: z.record(campaignJobStatusSchema, z.number().int().min(0)),
  /** Jobs carrying a match score, however they were later resolved. */
  scored: z.number().int().min(0).default(0),
});

export const campaignNetworkingSummarySchema = z.object({
  kind: z.literal("networking"),
  discovered: z.number().int().min(0).default(0),
  drafted: z.number().int().min(0).default(0),
  sent: z.number().int().min(0).default(0),
  replied: z.number().int().min(0).default(0),
  bounced: z.number().int().min(0).default(0),
});

export const campaignSummarySchema = z.discriminatedUnion("kind", [
  campaignJobSummarySchema,
  campaignNetworkingSummarySchema,
]);

/** Composer-driven sources require a user-selected base resume; `apply` tailors per job. */
const RESUME_REQUIRED_SOURCES: readonly CampaignSource[] = ["search", "auto-apply", "networking"];

/** Returns whether a configuration satisfies its source's required fields. */
export function campaignConfigSupportsSource(
  source: CampaignSource,
  config: CampaignConfig,
): boolean {
  return !RESUME_REQUIRED_SOURCES.includes(source) || !!config.resumeId;
}

export const createCampaignSchema = z
  .object({
    query: z.string().min(1),
    source: campaignSourceSchema,
    config: campaignConfigSchema.optional(),
  })
  .refine((v) => campaignConfigSupportsSource(v.source, v.config ?? {}), {
    message: "config.resumeId is required for search, auto-apply, and networking campaigns.",
    path: ["config", "resumeId"],
  });

export const updateCampaignConfigSchema = z.object({
  config: campaignConfigSchema,
});

export const campaignStatusCommandSchema = z.object({
  status: campaignStatusSchema,
});

export const CAMPAIGN_JOB_TERMINAL_OUTCOMES = ["applied", "failed", "skipped"] as const;
export const campaignJobOutcomeSchema = z.enum(CAMPAIGN_JOB_TERMINAL_OUTCOMES);

/** Non-terminal statuses: a campaign with any such job is still active (not finalizable). */
export const CAMPAIGN_JOB_ACTIVE_STATUSES = [
  "pending",
  "approved",
  "applying",
  "needs_user",
] as const;

export const addCampaignJobSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  url: z.url(),
  board: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: reasonText.optional().nullable(),
  status: z.enum(CAMPAIGN_JOB_ACTIVE_STATUSES).optional(),
  description: z.string().optional().nullable(),
  digest: z.string().optional().nullable(),
});

export const patchCampaignJobSchema = z.object({
  status: z.enum(CAMPAIGN_JOB_ACTIVE_STATUSES).optional(),
  retryNotes: reasonText.optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: reasonText.optional().nullable(),
  description: z.string().optional().nullable(),
  digest: z.string().optional().nullable(),
});

export const rescanCampaignJobSchema = z
  .object({
    decision: z.enum(["approved", "skipped"]),
    matchScore: z.number().int().min(0).max(100),
    matchReason: reasonText,
    skipReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    description: z.string().optional().nullable(),
    digest: z.string().optional().nullable(),
  })
  .refine((value) => value.decision !== "skipped" || !!value.skipReason, {
    message: "A skipped rescan decision requires skipReason.",
    path: ["skipReason"],
  });

export const retryCampaignJobSchema = z.object({
  retryNotes: reasonText.optional().nullable(),
});

/** One skip/fail reason with how many of the campaign's jobs carry it. */
export const campaignJobReasonSchema = z.object({
  kind: z.enum(["skipped", "failed"]),
  reason: z.string(),
  count: z.number().int().min(0),
});

export const campaignJobResultSchema = z
  .object({
    outcome: campaignJobOutcomeSchema,
    appliedAt: z.iso.datetime().optional(),
    failReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    skipReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    retryNotes: reasonText.optional().nullable(),
    matchScore: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (v) =>
      (v.outcome !== "applied" || !!v.appliedAt) &&
      (v.outcome !== "failed" || !!v.failReason) &&
      (v.outcome !== "skipped" || !!v.skipReason),
    {
      message:
        "applied requires appliedAt; failed requires failReason; skipped requires skipReason.",
    },
  );

export type CampaignJobOutcome = z.infer<typeof campaignJobOutcomeSchema>;
export type CampaignJobResultInput = z.infer<typeof campaignJobResultSchema>;

export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type CampaignJobStatus = z.infer<typeof campaignJobStatusSchema>;
export type CampaignConfig = z.infer<typeof campaignConfigSchema>;
export type CampaignSummary = z.infer<typeof campaignSummarySchema>;
export type CampaignJobSummary = z.infer<typeof campaignJobSummarySchema>;
export type CampaignJobReason = z.infer<typeof campaignJobReasonSchema>;
export type CampaignNetworkingSummary = z.infer<typeof campaignNetworkingSummarySchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignConfigInput = z.infer<typeof updateCampaignConfigSchema>;
export type CampaignStatusCommandInput = z.infer<typeof campaignStatusCommandSchema>;
export type AddCampaignJobInput = z.infer<typeof addCampaignJobSchema>;
export type PatchCampaignJobInput = z.infer<typeof patchCampaignJobSchema>;
export type RescanCampaignJobInput = z.infer<typeof rescanCampaignJobSchema>;
export type RetryCampaignJobInput = z.infer<typeof retryCampaignJobSchema>;
export type CampaignSource = z.infer<typeof campaignSourceSchema>;
