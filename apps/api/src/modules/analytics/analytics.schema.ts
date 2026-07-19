import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** A single day's count in a 30-day timeline series (`date` is UTC midnight of the bucketed day). */
const perDayPointSchema = z.object({
  date: z.date(),
  count: z.number().int(),
});

/** Dashboard analytics summary aggregating application and networking activity. */
export const analyticsStatsSchema = z.object({
  totals: z.object({
    applications: z.number().int(),
    submitted: z.number().int(),
    interviewing: z.number().int(),
    offers: z.number().int(),
    rejected: z.number().int(),
    queueDepth: z.number().int(),
  }),
  thisWeek: z.object({
    submitted: z.number().int(),
    interviewing: z.number().int(),
    rejected: z.number().int(),
  }),
  responseRatePct: z.number().int(),
  statusBreakdown: z.array(
    z.object({
      status: z.string(),
      count: z.number().int(),
    }),
  ),
  perDay: z.array(perDayPointSchema),
  topBoards: z.array(
    z.object({
      board: z.string(),
      count: z.number().int(),
    }),
  ),
  topRejectReasons: z.array(
    z.object({
      reason: z.string(),
      count: z.number().int(),
    }),
  ),
  networking: z.object({
    totals: z.object({
      contacts: z.number().int(),
      sent: z.number().int(),
      replied: z.number().int(),
      bounced: z.number().int(),
    }),
    thisWeek: z.object({
      sent: z.number().int(),
      replied: z.number().int(),
    }),
    replyRatePct: z.number().int(),
    perDaySent: z.array(perDayPointSchema),
    topContactSources: z.array(
      z.object({
        source: z.string(),
        count: z.number().int(),
      }),
    ),
  }),
});
