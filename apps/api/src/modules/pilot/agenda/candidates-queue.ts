import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig, resolveMinScore } from "@/modules/campaign/campaign.config";
import { GATHER_CAP, QUEUE_BATCH, SCORE_PENDING_COOLDOWN_MS } from "./constants";
import { claimableCampaigns } from "./gather-jobs";
import type { AgendaQueueDrain } from "./types";

const QUEUED = { status: "queued" } satisfies Prisma.JobWhereInput;

/** Apply campaigns with unvisited pasted links. Claim-damped: a dead URL stays queued forever
 *  and would re-win every cycle without a cooldown. */
export async function gatherQueueDrain(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<AgendaQueueDrain[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: "in_progress", source: "apply", jobs: { some: QUEUED } },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      config: true,
      // Total backlog beside the sampled entries, without a second round trip.
      _count: { select: { jobs: { where: QUEUED } } },
      jobs: {
        where: QUEUED,
        orderBy: { createdAt: "asc" },
        take: QUEUE_BATCH,
        select: { key: true, url: true },
      },
    },
  });

  const claimable = await claimableCampaigns(
    prisma,
    userId,
    "queue.drain",
    SCORE_PENDING_COOLDOWN_MS,
    now,
    campaigns,
  );
  return claimable.map((c) => ({
    campaignId: c.campaignId,
    resumeId: parseCampaignConfig(c.config).resumeId,
    minScore: resolveMinScore(c.config, fallbackMinScore),
    queuedCount: c._count.jobs,
    entries: c.jobs,
  }));
}
