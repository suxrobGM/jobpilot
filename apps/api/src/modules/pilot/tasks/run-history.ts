import { HOUR_MS } from "@/common/date/buckets";
import type { PilotRun, PilotRunOutcome, PrismaClient } from "@/generated/prisma/client";
import type { JobRef } from "@/modules/campaign/jobs/apply-guard";

/** Row cap for the unbounded gather and expiry scans. */
export const GATHER_CAP = 200;

/** A crash (expired/cancelled run) was not a decision, so it retries sooner than any cooldown. */
const CRASH_RETRY_MS = 2 * HOUR_MS;

/** The agent never finished, as opposed to deciding. */
const CRASH_OUTCOMES: PilotRunOutcome[] = ["expired", "cancelled"];

export function isCrash(outcome: PilotRunOutcome | null): boolean {
  return outcome !== null && CRASH_OUTCOMES.includes(outcome);
}

type RunHistory = Pick<PilotRun, "startedAt" | "finishedAt" | "outcome">;

const HISTORY_SELECT = { startedAt: true, finishedAt: true, outcome: true } as const;

export function latestRun(prisma: PrismaClient, userId: string, taskType: string) {
  return prisma.pilotRun.findFirst({
    where: { userId, taskType },
    orderBy: { startedAt: "desc" },
    select: HISTORY_SELECT,
  });
}

export async function latestRunBySubject(
  prisma: PrismaClient,
  userId: string,
  taskType: string,
  subjectIds: string[],
): Promise<Map<string, RunHistory>> {
  const runs = await prisma.pilotRun.findMany({
    where: { userId, taskType, subjectId: { in: subjectIds } },
    orderBy: { startedAt: "desc" },
    take: GATHER_CAP,
    select: { subjectId: true, ...HISTORY_SELECT },
  });
  const latest = new Map<string, RunHistory>();
  for (const { subjectId, ...run } of runs) {
    if (!latest.has(subjectId)) latest.set(subjectId, run);
  }
  return latest;
}

/** An open run is still running; a finished one holds the subject back for `cooldownMs`. */
export function ranRecently(
  last: RunHistory | null | undefined,
  now: Date,
  cooldownMs: number,
): boolean {
  if (!last) return false;
  if (!last.finishedAt) return true;
  const cooldown = isCrash(last.outcome) ? Math.min(cooldownMs, CRASH_RETRY_MS) : cooldownMs;
  return now.getTime() - last.finishedAt.getTime() < cooldown;
}

interface RecentRunFilter {
  userId: string;
  taskType: string;
  now: Date;
  cooldownMs: number;
}

export async function withoutRecentRuns<T>(
  prisma: PrismaClient,
  { userId, taskType, now, cooldownMs }: RecentRunFilter,
  rows: T[],
  subjectOf: (row: T) => string,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const latest = await latestRunBySubject(prisma, userId, taskType, rows.map(subjectOf));
  return rows.filter((row) => !ranRecently(latest.get(subjectOf(row)), now, cooldownMs));
}

/** Rows no open or decided run has taken yet: once-only work, where a crash hands it back. */
export async function withoutConsumingRuns<T>(
  prisma: PrismaClient,
  userId: string,
  taskType: string,
  rows: T[],
  subjectOf: (row: T) => string,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const runs = await prisma.pilotRun.findMany({
    where: {
      userId,
      taskType,
      subjectId: { in: rows.map(subjectOf) },
      OR: [{ finishedAt: null }, { outcome: { notIn: CRASH_OUTCOMES } }],
    },
    take: GATHER_CAP,
    select: { subjectId: true },
  });
  const consumed = new Set(runs.map((run) => run.subjectId));
  return rows.filter((row) => !consumed.has(subjectOf(row)));
}

/** Every producer and damper read must agree on a job's subject byte for byte. */
export function jobSubjectId(job: JobRef): string {
  return `${job.campaignId}:${job.key}`;
}

/** The inverse of {@link jobSubjectId}, for question subjects written the same way. */
export function parseJobSubject(subjectId: string): JobRef {
  const separator = subjectId.indexOf(":");
  if (separator <= 0 || separator === subjectId.length - 1) {
    throw new Error(`Invalid job subject: ${subjectId}`);
  }
  return { campaignId: subjectId.slice(0, separator), key: subjectId.slice(separator + 1) };
}
