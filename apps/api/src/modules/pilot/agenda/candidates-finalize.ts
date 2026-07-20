import { CAMPAIGN_JOB_ACTIVE_STATUSES } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AgendaFinalizeCampaign } from "./types";

/** Finds source-aware campaigns whose active work is exhausted. */
export function gatherFinalizeCampaigns(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaFinalizeCampaign[]> {
  return prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      OR: [
        {
          source: { not: "networking" },
          jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
        },
        {
          source: "networking",
          networkingMessages: { none: { status: { in: ["draft", "approved"] } } },
        },
      ],
    },
    select: { campaignId: true, query: true },
  });
}
