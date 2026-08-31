import {
  type PilotInstructionsChange,
  type PilotInstructionsConfig,
  type PilotInstructionsImpact,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { SERVER_SKIP_REASONS } from "./stats";

export function parseInstructionsConfig(value: unknown): PilotInstructionsConfig {
  return pilotInstructionsConfigSchema.parse(value);
}

export async function loadInstructions(
  prisma: Pick<PrismaClient, "pilotState">,
  userId: string,
): Promise<{ config: PilotInstructionsConfig; goals: string }> {
  const state = await prisma.pilotState.findUnique({
    where: { userId },
    select: { instructionsConfig: true, instructionsGoals: true },
  });
  return {
    config: parseInstructionsConfig(state?.instructionsConfig ?? {}),
    goals: state?.instructionsGoals ?? "",
  };
}

/** What an instructions edit would leave running, so the user can decide before saving. */
export async function readInstructionsImpact(
  prisma: PrismaClient,
  userId: string,
): Promise<PilotInstructionsImpact> {
  const [searches, campaigns, approved] = await Promise.all([
    prisma.pilotSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, query: true, reason: true },
    }),
    prisma.campaign.findMany({
      where: { userId, createdBy: "pilot", status: "in_progress" },
      orderBy: { startedAt: "asc" },
      select: {
        campaignId: true,
        query: true,
        _count: { select: { jobs: { where: { status: "approved" } } } },
      },
    }),
    prisma.job.aggregate({
      where: { status: "approved", campaign: { userId, createdBy: "pilot" } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
  ]);

  return {
    searches,
    campaigns: campaigns.map((c) => ({
      campaignId: c.campaignId,
      query: c.query,
      approvedJobs: c._count.jobs,
    })),
    approvedJobs: approved._count._all,
    oldestApprovedAt: approved._min.createdAt,
  };
}

/**
 * Retires whatever the user chose to leave behind. Deleting the searches is what lets
 * `strategy.bootstrap` derive new ones from the new goals - it is gated on there being none - and
 * its own claim damper has to go with them or the next cycle skips it for a day.
 */
export async function retireForNewGoals(
  prisma: PrismaClient,
  userId: string,
  change: PilotInstructionsChange,
) {
  const writes = [];
  if (change.rederiveSearches) {
    writes.push(
      prisma.pilotSearch.deleteMany({ where: { userId } }),
      prisma.pilotClaim.deleteMany({ where: { userId, kind: "strategy.bootstrap" } }),
    );
  }
  if (change.dropApprovedJobs) {
    writes.push(
      prisma.job.updateMany({
        where: { status: "approved", campaign: { userId, createdBy: "pilot" } },
        data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.goalsChanged },
      }),
    );
  }
  if (change.completeCampaigns) {
    writes.push(
      prisma.campaign.updateMany({
        where: { userId, createdBy: "pilot", status: "in_progress" },
        data: {
          status: "completed",
          statusActor: "user",
          statusReason: "Goals changed.",
          completedAt: new Date(),
        },
      }),
    );
  }
  if (writes.length > 0) await prisma.$transaction(writes);
}
