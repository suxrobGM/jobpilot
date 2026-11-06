import { z } from "zod/v4";
import { boardRefSchema } from "../job-board";

export const reportPilotSearchRunSchema = z.object({
  jobsScanned: z.number().int().min(0),
  newJobs: z.number().int().min(0),
  reachedEnd: z.boolean(),
});

export const pilotSearchSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  query: z.string(),
  board: boardRefSchema.nullable(),
  resumeId: z.uuid().nullable(),
  reason: z.string(),
  lastRunAt: z.date().nullable(),
  lastJobsScanned: z.number().int().nullable(),
  lastNewJobs: z.number().int().nullable(),
  emptyRuns: z.number().int(),
  nextRunAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The list adds what the pilot home shows beside each search. */
export const pilotSearchListSchema = z.array(
  pilotSearchSchema.extend({ appliedThisWeek: z.number().int(), paused: z.boolean() }),
);

export type ReportPilotSearchRunInput = z.infer<typeof reportPilotSearchRunSchema>;
export type PilotSearch = z.infer<typeof pilotSearchSchema>;
