import { campaignJobStatusSchema } from "@jobpilot/contracts/campaign";
import { pilotJournalEntrySchema, tokenUsageSchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { SKIP_BUCKETS } from "./skip-reasons";

export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

export const pilotTodayOutcomesSchema = z.object({
  skipped: z.number().int(),
  failed: z.number().int(),
  skipReasons: z.array(z.object({ reason: z.enum(SKIP_BUCKETS), count: z.number().int() })),
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
  // The host's pre-inject gate reads this, so a probe costs no PilotState write.
  running: z.boolean(),
  // The last cycle's planned sleep, so a restarted host waits out the break.
  lastCycle: z
    .object({
      completedAt: z.date(),
      sleepSeconds: z.number().int().nullable(),
    })
    .nullable(),
});

/** A POST so a digest's worth of URLs fits; nothing is written. */
export const jobAlertsSeenBodySchema = z.object({
  urls: z.array(z.string().trim().min(1)).min(1).max(500),
  withinDays: z.number().int().min(1).max(90).default(7),
});

export const jobAlertsSeenSchema = z.object({ seen: z.array(z.string()) });

const similarJobsPostingSchema = z.object({
  title: z.string().trim().min(1),
  company: z.string().trim().min(1),
  location: z.string().nullish(),
});

/** A POST so a batch fits; nothing is written. */
export const similarJobsBodySchema = z.object({
  postings: z.array(similarJobsPostingSchema).min(1).max(100),
  withinDays: z.number().int().min(1).max(90).default(30),
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
