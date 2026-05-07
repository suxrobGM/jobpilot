import { z } from "zod/v4";

export const RUN_STATUSES = [
  "in_progress",
  "paused",
  "completed",
  "failed",
] as const;
export const runStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const RUN_SOURCES = ["autopilot", "apply-batch"] as const;
export const runSourceSchema = z.enum(RUN_SOURCES);
export type RunSource = z.infer<typeof runSourceSchema>;

export const RUN_JOB_STATUSES = [
  "pending",
  "approved",
  "applying",
  "applied",
  "failed",
  "skipped",
] as const;
export const runJobStatusSchema = z.enum(RUN_JOB_STATUSES);
export type RunJobStatus = z.infer<typeof runJobStatusSchema>;

export const runConfigSchema = z.object({
  minMatchScore: z.number().int().min(0).max(10).optional(),
  maxApplications: z.number().int().min(1).max(500).optional(),
  boards: z.array(z.string()).optional(),
});
export type RunConfig = z.infer<typeof runConfigSchema>;

export const runSummarySchema = z.object({
  totalFound: z.number().int().min(0).default(0),
  qualified: z.number().int().min(0).default(0),
  applied: z.number().int().min(0).default(0),
  failed: z.number().int().min(0).default(0),
  skipped: z.number().int().min(0).default(0),
  remaining: z.number().int().min(0).default(0),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const createRunSchema = z.object({
  runId: z.string().min(1),
  query: z.string().min(1),
  source: runSourceSchema,
  config: runConfigSchema.optional(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const updateRunSchema = z.object({
  status: runStatusSchema.optional(),
  summary: runSummarySchema.partial().optional(),
  completedAt: z.iso.datetime().optional().nullable(),
});
export type UpdateRunInput = z.infer<typeof updateRunSchema>;

export const addRunJobSchema = z.object({
  jobKey: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  url: z.url(),
  board: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: z.string().optional().nullable(),
  status: runJobStatusSchema.optional(),
  description: z.string().optional().nullable(),
});
export type AddRunJobInput = z.infer<typeof addRunJobSchema>;

export const patchRunJobSchema = z.object({
  status: runJobStatusSchema.optional(),
  appliedAt: z.iso.datetime().optional().nullable(),
  failReason: z.string().optional().nullable(),
  retryNotes: z.string().optional().nullable(),
  skipReason: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: z.string().optional().nullable(),
});
export type PatchRunJobInput = z.infer<typeof patchRunJobSchema>;

export const RUN_EVENT_TYPES = ["log", "progress", "status", "job-update"] as const;
export const runEventTypeSchema = z.enum(RUN_EVENT_TYPES);
export type RunEventType = z.infer<typeof runEventTypeSchema>;

export const runEventSchema = z.object({
  type: runEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type RunEventInput = z.infer<typeof runEventSchema>;
