import { z } from "zod/v4";

// The pilot's user-visible one-liner on why it chose this search; capped and rendered plain.
const reasonSchema = z.string().max(500).default("");

export const createPilotSearchSchema = z.object({
  query: z.string().min(1),
  board: z.string().optional(),
  // Base resume discovery scores against; carried onto the discovered campaign's config.
  resumeId: z.string().optional(),
  reason: reasonSchema,
});

/** Partial patch: an omitted field is left unchanged (the pilot is the single writer). */
export const updatePilotSearchSchema = createPilotSearchSchema.partial();

/** The agent's post-run report; the service turns it into the next-run schedule. */
export const reportPilotSearchRunSchema = z.object({
  jobsSeen: z.number().int().min(0),
  newJobs: z.number().int().min(0),
  reachedEnd: z.boolean(),
});

export const pilotSearchSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  query: z.string(),
  board: z.string().nullable(),
  resumeId: z.string().nullable(),
  reason: z.string(),
  lastRunAt: z.date().nullable(),
  lastJobsSeen: z.number().int().nullable(),
  lastNewJobs: z.number().int().nullable(),
  // Consecutive zero-new-jobs runs; clients derive "backing off" from `emptyRuns >= 3`.
  emptyRuns: z.number().int(),
  nextRunAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const pilotSearchListSchema = z.array(pilotSearchSchema);

export type CreatePilotSearchInput = z.infer<typeof createPilotSearchSchema>;
export type UpdatePilotSearchInput = z.infer<typeof updatePilotSearchSchema>;
export type ReportPilotSearchRunInput = z.infer<typeof reportPilotSearchRunSchema>;
export type PilotSearch = z.infer<typeof pilotSearchSchema>;
