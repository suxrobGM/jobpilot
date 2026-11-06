import { z } from "zod/v4";
import { boardRefSchema } from "./job-board";
import { cleanReplacementChars } from "./utils/text";

/** A free-text string with mangled replacement-char artifacts cleaned on write. */
const reasonText = z.string().transform(cleanReplacementChars);

/** The agent's job brief. `{}` drops to `undefined`: it would read as "has a brief" while the public
 *  index skips the row. */
export const jobBriefSchema = z.record(z.string(), z.json());
export type JobBriefData = z.infer<typeof jobBriefSchema>;
const jobBrief = jobBriefSchema.transform((value) =>
  Object.keys(value).length === 0 ? undefined : value,
);

/** Where a feed's jobs come from. */
export const FEED_KINDS = [
  "search",
  "job_alerts",
  "research",
  // Job links the user adds from the Pipeline.
  "links",
  // Skills the user types in the terminal.
  "manual",
  "upwork",
  "networking",
] as const;
const feedKindSchema = z.enum(FEED_KINDS);
export type FeedKind = z.infer<typeof feedKindSchema>;

/** The kinds whose scored jobs the pilot approves and applies to on its own. */
export const AUTO_APPLY_FEED_KINDS: readonly FeedKind[] = [
  "search",
  "job_alerts",
  "research",
  "links",
];

/** Why an employer is H-1B cap-exempt. */
export const CAP_EXEMPT_BASES = [
  "university",
  "university_affiliate",
  "nonprofit_research",
  "government_research",
] as const;
const capExemptBasisSchema = z.enum(CAP_EXEMPT_BASES);

/** Who acted: the web user, the terminal agent on their behalf, or the autonomous pilot. */
export const ACTORS = ["user", "agent", "pilot"] as const;
const actorSchema = z.enum(ACTORS);

export const JOB_STATUSES = [
  // Pre-discovery: a pasted URL not yet visited or scored.
  "queued",
  "pending",
  "approved",
  "applying",
  "applied",
  "failed",
  "skipped",
  // Parked by the Pilot mid-apply pending a user answer (see Question); non-terminal.
  "needs_user",
] as const;
export const jobStatusSchema = z.enum(JOB_STATUSES);

/** A feed job as responses and the feed event stream carry it. */
export const jobSchema = z.object({
  id: z.uuid(),
  feedId: z.uuid(),
  key: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  employmentType: z.string().nullable(),
  url: z.string(),
  board: boardRefSchema.nullable(),
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  status: jobStatusSchema,
  appliedAt: z.date().nullable(),
  failReason: z.string().nullable(),
  retryNotes: z.string().nullable(),
  skipReason: z.string().nullable(),
  description: z.string().nullable(),
  brief: jobBriefSchema.nullable(),
  capExemptBasis: capExemptBasisSchema.nullable(),
  capExemptEvidenceUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The add-job response: `duplicate` means the user already had this posting, returned as is. */
export const addedJobSchema = jobSchema.extend({ duplicate: z.boolean() });

/** Per-feed overrides, such as the min score a search tune sets. */
export const feedConfigSchema = z.object({
  minScore: z.number().int().min(0).max(100).optional(),
});

export const feedSchema = z.object({
  id: z.uuid(),
  kind: feedKindSchema,
  name: z.string(),
  query: z.string().nullable(),
  board: boardRefSchema.nullable(),
  resumeId: z.uuid().nullable(),
  reason: z.string(),
  config: feedConfigSchema,
  pausedAt: z.date().nullable(),
  pausedBy: actorSchema.nullable(),
  pausedReason: z.string().nullable(),
  createdBy: actorSchema,
  lastRunAt: z.date().nullable(),
  lastJobsScanned: z.number().int().nullable(),
  lastNewJobs: z.number().int().nullable(),
  emptyRuns: z.number().int(),
  nextRunAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The list adds what the pilot home shows beside each search. */
export const feedListSchema = z.array(feedSchema.extend({ appliedThisWeek: z.number().int() }));

export const feedsQuerySchema = z.object({ kind: feedKindSchema.optional() });

/** How many links one Add job links accepts. */
export const MAX_LINKS = 50;

/** Get-or-create: every kind but `search` has one feed per user. Searches are made by changes. */
export const createFeedSchema = z.object({
  kind: feedKindSchema.exclude(["search"]),
});

/** Pausing a feed stops the pilot gathering from it; the agent pauses one whose board blocks it. */
export const updateFeedSchema = z.object({
  paused: z.boolean(),
  actor: actorSchema.default("user"),
  reason: z.string().min(1).max(300).transform(cleanReplacementChars).optional(),
});

export const reportSearchRunSchema = z.object({
  jobsScanned: z.number().int().min(0),
  newJobs: z.number().int().min(0),
  reachedEnd: z.boolean(),
});

export const JOB_TERMINAL_OUTCOMES = ["applied", "failed", "skipped"] as const;
const jobOutcomeSchema = z.enum(JOB_TERMINAL_OUTCOMES);

/** Non-terminal statuses: a feed with any such job is still active (not finalizable). */
const JOB_ACTIVE_STATUSES = ["queued", "pending", "approved", "applying", "needs_user"] as const;

export const addJobSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  url: z.url(),
  board: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: reasonText.optional().nullable(),
  status: z.enum(JOB_ACTIVE_STATUSES).optional(),
  description: z.string().optional().nullable(),
  brief: jobBrief.optional().nullable(),
  capExemptBasis: capExemptBasisSchema.optional().nullable(),
  capExemptEvidenceUrl: z.url().optional().nullable(),
});

export const patchJobSchema = z.object({
  status: z.enum(JOB_ACTIVE_STATUSES).optional(),
  // The score pass fleshes out a queued row - seeded from a bare URL - with the real posting.
  title: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
  retryNotes: reasonText.optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: reasonText.optional().nullable(),
  description: z.string().optional().nullable(),
  brief: jobBrief.optional().nullable(),
});

export const rescanJobSchema = z
  .object({
    decision: z.enum(["approved", "skipped"]),
    matchScore: z.number().int().min(0).max(100),
    matchReason: reasonText,
    skipReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    description: z.string().optional().nullable(),
    brief: jobBrief.optional().nullable(),
  })
  .refine((value) => value.decision !== "skipped" || !!value.skipReason, {
    message: "A skipped rescan decision requires skipReason.",
    path: ["skipReason"],
  });

export const retryJobSchema = z.object({
  retryNotes: reasonText.optional().nullable(),
});

/** One skip/fail reason with how many of the feed's jobs carry it. */
export const jobReasonSchema = z.object({
  kind: z.enum(["skipped", "failed"]),
  reason: z.string(),
  count: z.number().int().min(0),
});

export const jobResultSchema = z
  .object({
    outcome: jobOutcomeSchema,
    appliedAt: z.iso.datetime().optional(),
    failReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    skipReason: z.string().min(1).transform(cleanReplacementChars).optional(),
    retryNotes: reasonText.optional().nullable(),
    matchScore: z.number().int().min(0).max(100).optional(),
    // The resume actually submitted. `resumeVariantId` is absent when the base went out untailored;
    // both are absent on an outcome that never reached a form.
    resumeId: z.uuid().optional(),
    resumeVariantId: z.uuid().optional(),
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

export type JobResultInput = z.infer<typeof jobResultSchema>;

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobReason = z.infer<typeof jobReasonSchema>;
export type CreateFeedInput = z.infer<typeof createFeedSchema>;
export type UpdateFeedInput = z.infer<typeof updateFeedSchema>;
export type ReportSearchRunInput = z.infer<typeof reportSearchRunSchema>;
export type AddJobInput = z.infer<typeof addJobSchema>;
export type PatchJobInput = z.infer<typeof patchJobSchema>;
export type RescanJobInput = z.infer<typeof rescanJobSchema>;
export type RetryJobInput = z.infer<typeof retryJobSchema>;
