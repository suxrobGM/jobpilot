import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig, resolveMinScore } from "@/modules/campaign/campaign.config";
import { GATHER_CAP, QUEUE_BATCH, SCORE_PENDING_COOLDOWN_MS } from "./constants";
import { claimDamped, latestClaimBySubject } from "./gather-jobs";
import type { AgendaQueueDrain } from "./types";

const QUEUED = { status: "queued" } satisfies Prisma.JobWhereInput;

/**
 * In-progress apply campaigns holding pasted links nothing has visited yet. Each carries
 * ≤{@link QUEUE_BATCH} sampled entries plus the total backlog count.
 *
 * Claim-damped per campaign like the score-pending gather: a link nothing can open (dead URL,
 * login wall) stays queued forever, and without a cooldown it would re-win every cycle.
 */
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

  // One grouped count for every candidate's total backlog, avoiding an N+1 per campaign.
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
