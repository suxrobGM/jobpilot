import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { BOOTSTRAP_RETRY_MS } from "./constants";
import { claimDamped } from "./gather-jobs";
import type { AgendaStrategyBootstrap } from "./types";

/** Offers "derive searches from goals" setup only when goals exist, no searches do, and no recent claim. */
export async function gatherBootstrap(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  goals: string,
  now: Date,
  searchCount: number,
): Promise<AgendaStrategyBootstrap | null> {
  const trimmedGoals = goals.trim();
  // Blank goals need no item - emptyReason "awaitingSetup" already flags them.
  if (searchCount > 0 || trimmedGoals.length === 0) {
    return null;
  }

  const lastClaim = await prisma.pilotClaim.findFirst({
    where: { userId, kind: "strategy.bootstrap" },
    orderBy: { grantedAt: "desc" },
    select: { grantedAt: true, releasedAt: true, outcome: true },
  });

  // The only work an unconfigured account has, so a crashed claim must retry in hours, not the full day.
  if (claimDamped(lastClaim ?? undefined, now, BOOTSTRAP_RETRY_MS)) {
    return null;
  }

  return {
    goals: trimmedGoals,
    boards: config.boards,
    minScore: config.minScore,
  };
}
