import { newTokens, sumTokenUsage, tokenUsage } from "@jobpilot/contracts/pilot";
import { DAY_MS, startOfDay } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { isCrash } from "./runs/run-history";

/** Runs older than a week describe a version of the agent you are no longer running. */
export const COST_WINDOW_MS = 7 * DAY_MS;

export function countAppliedToday(
  prisma: Pick<PrismaClient, "application">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.application.count({ where: { userId, appliedAt: { gte: startOfDay(now) } } });
}

export function countSentToday(
  prisma: Pick<PrismaClient, "networkingMessage">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.networkingMessage.count({ where: { userId, sentAt: { gte: startOfDay(now) } } });
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Most new tokens first. A run carries its whole cycle's usage. */
export async function costByTaskType(
  prisma: Pick<PrismaClient, "pilotRun">,
  userId: string,
  now: Date,
) {
  const rows = await prisma.pilotRun.findMany({
    where: {
      userId,
      finishedAt: { not: null },
      startedAt: { gte: new Date(now.getTime() - COST_WINDOW_MS) },
    },
    // Uncapped: any cap short enough to matter would quietly shorten the week being reported.
    select: {
      taskType: true,
      outcome: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
  });

  return [...Map.groupBy(rows, (run) => run.taskType)]
    .map(([taskType, runs]) => {
      const usages = runs.map(tokenUsage);
      return {
        taskType,
        runs: runs.length,
        medianNewTokens: median(usages.map(newTokens).sort((a, b) => a - b)),
        tokens: sumTokenUsage(usages),
        failed: runs.filter((run) => run.outcome === "failed").length,
        unfinished: runs.filter((run) => isCrash(run.outcome)).length,
      };
    })
    .sort((a, b) => newTokens(b.tokens) - newTokens(a.tokens));
}
