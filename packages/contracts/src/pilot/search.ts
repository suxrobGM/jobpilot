import { z } from "zod/v4";
import { boardRefSchema } from "../job-board";

// Shown to the user as plain text.
const reasonText = z.string().max(500);
const reasonSchema = reasonText.default("");

export const createPilotSearchSchema = z.object({
  query: z.string().min(1),
  /** The board's domain, resolved to a catalog row. */
  board: z.string().trim().min(1).optional(),
  resumeId: z.string().optional(),
  reason: reasonSchema,
});

/** A patch leaves an omitted field unchanged, so `reason` drops the create default here. */
export const updatePilotSearchSchema = createPilotSearchSchema
  .extend({ reason: reasonText })
  .partial();

export const reportPilotSearchRunSchema = z.object({
  jobsSeen: z.number().int().min(0),
  newJobs: z.number().int().min(0),
  reachedEnd: z.boolean(),
});

export const pilotSearchSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  query: z.string(),
  board: boardRefSchema.nullable(),
  resumeId: z.string().nullable(),
  reason: z.string(),
  lastRunAt: z.date().nullable(),
  lastJobsSeen: z.number().int().nullable(),
  lastNewJobs: z.number().int().nullable(),
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
