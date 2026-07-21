import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { BOOTSTRAP_RETRY_MS } from "./constants";
import { claimDamped } from "./gather-jobs";
import type { AgendaStrategyBootstrap } from "./types";

/** Offers setup work only when searches, questions, and recent bootstrap claims permit it. */
export async function gatherBootstrap(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  goals: string,
  now: Date,
): Promise<AgendaStrategyBootstrap | null> {
  if (config.savedSearches.length > 0) return null;
  const [lastClaim, openQuestion] = await Promise.all([
    prisma.pilotClaim.findFirst({
      where: { userId, kind: "strategy.bootstrap" },
      orderBy: { grantedAt: "desc" },
      select: { grantedAt: true, releasedAt: true, outcome: true },
    }),
    prisma.pilotQuestion.findFirst({
      where: { userId, subjectType: "pilot", subjectId: "bootstrap", status: "open" },
      select: { id: true },
    }),
  ]);
  // The only work an unconfigured account has, so a crashed claim must retry in hours, not the full day.
  if (openQuestion || claimDamped(lastClaim ?? undefined, now, BOOTSTRAP_RETRY_MS)) return null;
  const trimmedGoals = goals.trim();
  return {
    goals: trimmedGoals,
    hasGoals: trimmedGoals.length > 0,
    boards: config.boards,
    minScore: config.minScore,
  };
}
