import type { CampaignSummary } from "@jobpilot/contracts/campaign";
import type { CampaignSource, Job, PrismaClient } from "@/generated/prisma/client";
import { PROMOTABLE_SOURCES } from "../campaign.mapper";
import { deriveCampaignSummary } from "../campaign.summary";

export interface ScoredJobPromotion {
  key: string;
  matchScore: number;
  threshold: number;
}

interface PromotionGroup {
  approved: boolean;
  score: number;
  threshold: number;
  keys: string[];
}

/**
 * One write per (outcome, score) group rather than three per row. Grouping by score keeps the
 * `matchScore` guard - which detects a concurrent rescore - exact under an `in` on keys, and lets
 * skipped rows sharing a score share their score-bearing reason prose.
 */
function groupByOutcomeAndScore(candidates: ScoredJobPromotion[]): PromotionGroup[] {
  const groups = new Map<string, PromotionGroup>();

  for (const candidate of candidates) {
    const approved = candidate.matchScore >= candidate.threshold;
    const groupKey = `${approved}:${candidate.matchScore}`;
    const group = groups.get(groupKey) ?? {
      approved,
      score: candidate.matchScore,
      threshold: candidate.threshold,
      keys: [],
    };
    group.keys.push(candidate.key);
    groups.set(groupKey, group);
  }
  return [...groups.values()];
}

/** Settles scored pending rows into `approved`/`skipped` and returns the rows that actually moved. */
export async function writeScoredPromotions(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  source: CampaignSource,
  candidates: ScoredJobPromotion[],
): Promise<{ jobs: Job[]; summary: CampaignSummary }> {
  const groups = groupByOutcomeAndScore(candidates);

  return prisma.$transaction(async (tx) => {
    const jobs: Job[] = [];

    for (const group of groups) {
      const updated = await tx.job.updateManyAndReturn({
        where: {
          campaignId,
          status: "pending",
          matchScore: group.score,
          key: { in: group.keys },
          campaign: { userId, status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
        },
        data: group.approved
          ? { status: "approved" }
          : {
              status: "skipped",
              skipReason: `Below minimum match score (${group.score} < ${group.threshold})`,
            },
      });
      jobs.push(...updated);
    }

    return { jobs, summary: await deriveCampaignSummary(tx, campaignId, source) };
  });
}
