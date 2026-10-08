import type { TokenUsage } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { HOUR_MS } from "@/common/date/buckets";
import type { Job, PilotRun, PilotRunOutcome, PrismaClient } from "@/generated/prisma/client";

/** Row cap for the unbounded gather and expiry scans. */
export const GATHER_CAP = 200;

/** A crash (expired/cancelled run) was not a decision, so it retries sooner than any cooldown. */
const CRASH_RETRY_MS = 2 * HOUR_MS;

/** The agent never finished, as opposed to deciding. */
export const CRASH_OUTCOMES: PilotRunOutcome[] = ["expired", "cancelled"];

export function isCrash(outcome: PilotRunOutcome | null): boolean {
  return outcome !== null && CRASH_OUTCOMES.includes(outcome);
}

type TokenColumn = "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens";

/** Nullable so a Prisma `_sum` fits as is. */
type TokenCounts = Record<TokenColumn, number | null>;

export function tokenUsage(counts: TokenCounts): TokenUsage {
  return {
    input: counts.inputTokens ?? 0,
    output: counts.outputTokens ?? 0,
    cacheRead: counts.cacheReadTokens ?? 0,
    cacheWrite: counts.cacheWriteTokens ?? 0,
  };
}

type RunHistory = Pick<PilotRun, "startedAt" | "finishedAt" | "outcome">;

type JobRef = Pick<Job, "campaignId" | "key">;

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

export async function withoutRecentRuns<T>(
  prisma: PrismaClient,
  userId: string,
  taskType: string,
  now: Date,
  cooldownMs: number,
  rows: T[],
  subjectOf: (row: T) => string,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const latest = await latestRunBySubject(prisma, userId, taskType, rows.map(subjectOf));
  return rows.filter((row) => !ranRecently(latest.get(subjectOf(row)), now, cooldownMs));
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

const jobRefSchema = z.object({ campaignId: z.string().min(1), jobKey: z.string().min(1) });

/** The job a `job.apply` run payload points at. */
export function parseJobRef(payload: unknown): JobRef {
  const { campaignId, jobKey } = jobRefSchema.parse(payload);
  return { campaignId, key: jobKey };
}
