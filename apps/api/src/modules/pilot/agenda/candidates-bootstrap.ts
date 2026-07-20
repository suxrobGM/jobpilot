import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { BOOTSTRAP_RETRY_MS } from "./constants";
import type { AgendaStrategyBootstrap } from "./types";

/** Offers setup work only when searches, questions, and recent bootstrap leases permit it. */
export async function gatherBootstrap(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  goals: string,
  now: Date,
): Promise<AgendaStrategyBootstrap | null> {
  if (config.savedSearches.length > 0) return null;
  const since = new Date(now.getTime() - BOOTSTRAP_RETRY_MS);
  const [recentLease, openQuestion] = await Promise.all([
    prisma.pilotLease.findFirst({
      where: { userId, kind: "strategy.bootstrap", grantedAt: { gte: since } },
      select: { id: true },
    }),
    prisma.question.findFirst({
      where: { userId, subjectType: "pilot", subjectId: "bootstrap", status: "open" },
      select: { id: true },
    }),
  ]);
  if (recentLease || openQuestion) return null;
  const trimmedGoals = goals.trim();
  return {
    goals: trimmedGoals,
    hasGoals: trimmedGoals.length > 0,
    boards: config.boards,
    minScore: config.minScore,
  };
}
