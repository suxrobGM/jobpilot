import { campaignJobStatusSchema } from "@jobpilot/contracts/campaign";
import {
  PILOT_RUN_OUTCOMES,
  pilotJournalEntrySchema,
  tokenUsageSchema,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { APPLIED_DUPLICATE_WINDOW_DAYS } from "@/modules/scoring/applied-duplicates";

export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

export const pilotCostSchema = z.object({
  items: z.array(
    z.object({
      taskType: z.string(),
      runs: z.number().int(),
      medianNewTokens: z.number().int(),
      tokens: tokenUsageSchema,
      failed: z.number().int(),
      unfinished: z.number().int(),
    }),
  ),
});

export const pilotActivityResponseSchema = z.object({
  lastActivityAt: z.date().nullable(),
  activeRuns: z.number().int(),
  // The last cycle's planned sleep, so a restarted host waits out the break.
  lastCycle: z
    .object({
      completedAt: z.date(),
      sleepSeconds: z.number().int().nullable(),
    })
    .nullable(),
});

export const researchStatusSchema = z.object({
  lastRun: z
    .object({
      startedAt: z.date(),
      outcome: z.enum(PILOT_RUN_OUTCOMES).nullable(),
      summary: z.string().nullable(),
    })
    .nullable(),
  campaignId: z.uuid().nullable(),
  requestedAt: z.date().nullable(),
});

const withinDaysSchema = z.number().int().min(1).max(90);

/** A POST so a digest's worth of URLs fits; nothing is written. */
export const existingJobsBodySchema = z.object({
  urls: z.array(z.string().trim().min(1)).min(1).max(500),
  withinDays: withinDaysSchema.default(7),
});

export type ExistingJobsBody = z.infer<typeof existingJobsBodySchema>;

export const existingJobsSchema = z.object({ existing: z.array(z.string()) });

const similarJobsPostingSchema = z.object({
  title: z.string().trim().min(1),
  company: z.string().trim().min(1),
  location: z.string().nullish(),
});

/** A POST so a batch fits; nothing is written. */
export const similarJobsBodySchema = z.object({
  postings: z.array(similarJobsPostingSchema).min(1).max(100),
  withinDays: withinDaysSchema.default(APPLIED_DUPLICATE_WINDOW_DAYS),
});
export type SimilarJobsBody = z.infer<typeof similarJobsBodySchema>;

export const similarJobsSchema = z.object({
  matches: z.array(
    z.object({
      index: z.number().int(),
      campaignId: z.uuid(),
      key: z.string(),
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      url: z.string(),
      status: campaignJobStatusSchema,
    }),
  ),
});
