import { DAY_MS, startOfDay } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  detectEligibilityRestrictions,
  ELIGIBILITY_RESTRICTION_KINDS,
} from "@/modules/scoring/eligibility";

/** Applications for the profile since UTC midnight - the daily apply budget's numerator. */
export function countAppliedToday(
  prisma: Pick<PrismaClient, "application">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.application.count({
    where: { userId, appliedAt: { gte: startOfDay(now) } },
  });
}

/** Networking messages sent for the profile since UTC midnight - the daily networking cap's numerator. */
export function countSentToday(
  prisma: Pick<PrismaClient, "networkingMessage">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.networkingMessage.count({
    where: { userId, sentAt: { gte: startOfDay(now) } },
  });
}

/** Reuses the scoring module's eligibility kinds; a private copy would drift from its patterns. */
export const SKIP_BUCKETS = [
  ...ELIGIBILITY_RESTRICTION_KINDS,
  "alreadyApplied",
  "captcha",
  "payment",
  "belowMinScore",
  "capReached",
  "postingClosed",
  "wentStale",
  "goalsChanged",
  "unanswered",
  "other",
] as const;
export type SkipBucket = (typeof SKIP_BUCKETS)[number];

/**
 * Skips the server writes itself. Their bucket is declared here rather than guessed at by the
 * classifier below, which only ever saw agent prose: left to it, "went stale" and "goals changed"
 * both land in `other`, and an expired question reads as a closed posting.
 */
export const SERVER_SKIP_REASONS = {
  wentStale: "Posting went stale before the pilot applied.",
  goalsChanged: "Goals changed before this was applied to.",
  unanswered: "Question expired without an answer.",
} satisfies Partial<Record<SkipBucket, string>>;

const SERVER_BUCKET_BY_REASON = new Map<string, SkipBucket>(
  Object.entries(SERVER_SKIP_REASONS).map(([bucket, reason]) => [reason, bucket as SkipBucket]),
);

/**
 * Buckets a free-text `skipReason`; agent-written prose means grouping the raw column in SQL yields
 * one row per wording. The literal checks match the phrasings `_shared/eligibility.md` tells the
 * agent to write.
 */
export function classifySkipReason(reason: string): SkipBucket {
  const server = SERVER_BUCKET_BY_REASON.get(reason);
  if (server) return server;

  const blocked = detectEligibilityRestrictions(reason)[0];
  if (blocked) return blocked.kind;

  const text = reason.toLowerCase();
  if (text.includes("already applied")) return "alreadyApplied";
  if (text.includes("captcha")) return "captcha";
  if (text.includes("payment")) return "payment";
  if (text.includes("minimum match score") || text.includes("below min")) return "belowMinScore";
  if (text.includes("cap reached")) return "capReached";
  if (text.includes("expired") || text.includes("no longer") || text.includes("closed")) {
    return "postingClosed";
  }
  return "other";
}

/** Claims older than this tell you about a version of the agent you are no longer running. */
const COST_WINDOW_MS = 7 * DAY_MS;

export interface PilotKindCost {
  kind: string;
  runs: number;
  /** Typical wall clock for one run of this kind. */
  medianMs: number;
  /** Where the week actually went - runs x duration, which is what ranks the kinds. */
  totalMs: number;
  failed: number;
  /** Claims that expired or were abandoned: work paid for and thrown away. */
  abandoned: number;
}

function median(values: number[]): number {
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return Math.round((values[mid - 1] + values[mid]) / 2);
}

/**
 * Where the pilot's time goes, by agenda kind. Reads `PilotClaim` rather than adding a telemetry
 * write: a claim already brackets exactly the work of one cycle (`grantedAt` to `releasedAt`) and
 * already carries the kind. Wall clock is a proxy for token spend, not a measure of it, but it is
 * the honest one available without parsing provider-specific session files.
 */
export async function costByKind(
  prisma: Pick<PrismaClient, "pilotClaim">,
  userId: string,
  now: Date,
): Promise<PilotKindCost[]> {
  const rows = await prisma.pilotClaim.findMany({
    where: {
      userId,
      releasedAt: { not: null },
      grantedAt: { gte: new Date(now.getTime() - COST_WINDOW_MS) },
    },
    // No row cap: a busy pilot cycles every ACTIVE_SLEEP_SECONDS, so any cap short enough to
    // matter would silently shorten the week the card says it is reporting.
    select: { kind: true, grantedAt: true, releasedAt: true, outcome: true },
  });

  const byKind = new Map<
    string,
    { durations: number[]; totalMs: number; failed: number; abandoned: number }
  >();
  for (const row of rows) {
    if (!row.releasedAt) continue;
    let bucket = byKind.get(row.kind);
    if (!bucket) {
      bucket = { durations: [], totalMs: 0, failed: 0, abandoned: 0 };
      byKind.set(row.kind, bucket);
    }
    const ms = row.releasedAt.getTime() - row.grantedAt.getTime();
    bucket.durations.push(ms);
    bucket.totalMs += ms;
    if (row.outcome === "failed") bucket.failed++;
    if (row.outcome === "expired" || row.outcome === "abandoned") bucket.abandoned++;
  }

  return [...byKind]
    .map(([kind, bucket]) => {
      const sorted = bucket.durations.sort((a, b) => a - b);
      return {
        kind,
        runs: sorted.length,
        medianMs: median(sorted),
        totalMs: bucket.totalMs,
        failed: bucket.failed,
        abandoned: bucket.abandoned,
      };
    })
    .sort((a, b) => b.totalMs - a.totalMs);
}

export interface PilotTodayOutcomes {
  skipped: number;
  failed: number;
  /** Buckets, most frequent first. Empty when nothing was skipped today. */
  skipReasons: { reason: SkipBucket; count: number }[];
}

/** Excludes applied on purpose: pilot state already reports that from `Application`. */
export async function countTodayOutcomes(
  prisma: Pick<PrismaClient, "job">,
  userId: string,
  now: Date,
): Promise<PilotTodayOutcomes> {
  const where = { campaign: { userId }, updatedAt: { gte: startOfDay(now) } };

  const [byStatus, skippedRows] = await Promise.all([
    prisma.job.groupBy({
      by: ["status"],
      where: { ...where, status: { in: ["skipped", "failed"] } },
      _count: { _all: true },
    }),
    // A day's skips are tens of rows, and the bucketing rule can't run in SQL.
    prisma.job.findMany({
      where: { ...where, status: "skipped", skipReason: { not: null } },
      select: { skipReason: true },
    }),
  ]);

  const counts = new Map<SkipBucket, number>();
  for (const row of skippedRows) {
    const bucket = classifySkipReason(row.skipReason ?? "");
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const statusCount = (status: "skipped" | "failed") =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    skipped: statusCount("skipped"),
    failed: statusCount("failed"),
    skipReasons: [...counts]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
