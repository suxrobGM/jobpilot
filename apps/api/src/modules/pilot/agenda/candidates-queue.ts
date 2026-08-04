import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig, resolveMinScore } from "@/modules/campaign/campaign.config";
import { GATHER_CAP, QUEUE_BATCH, SCORE_PENDING_COOLDOWN_MS } from "./constants";
import { claimDamped, latestClaimBySubject } from "./gather-jobs";
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
      query: true,
      config: true,
      jobs: {
        where: QUEUED,
        orderBy: { createdAt: "asc" },
        take: QUEUE_BATCH,
        select: { key: true, url: true },
      },
    },
  });
  if (campaigns.length === 0) {
    return [];
  }

  const counts = await prisma.job.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaigns.map((c) => c.campaignId) }, ...QUEUED },
    _count: { _all: true },
  });

  const countByCampaign = new Map(counts.map((r) => [r.campaignId, r._count._all]));
  const latest = await latestClaimBySubject(
    prisma,
    userId,
    "queue.drain",
    campaigns.map((c) => c.campaignId),
  );

  return campaigns
    .filter((c) => !claimDamped(latest.get(c.campaignId), now, SCORE_PENDING_COOLDOWN_MS))
    .map((c) => ({
      campaignId: c.campaignId,
      query: c.query,
      resumeId: parseCampaignConfig(c.config).resumeId,
      minScore: resolveMinScore(c.config, fallbackMinScore),
      queuedCount: countByCampaign.get(c.campaignId) ?? c.jobs.length,
      entries: c.jobs,
    }));
}
