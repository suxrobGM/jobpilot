import type { CampaignSource } from "@/generated/prisma/client";
import { resolveMinScore } from "@/modules/campaign/campaign.config";
import { PROMOTABLE_SOURCES } from "@/modules/campaign/campaign.mapper";
import { GATHER_CAP } from "./constants";
import type { JobMutationDeps } from "./job-mutations";

interface CampaignBatch {
  source: CampaignSource;
  threshold: number;
  candidates: { key: string; matchScore: number; threshold: number }[];
}

/**
 * Promote scored pending jobs of in-progress auto-apply and apply campaigns before the gathers:
 * at/above the campaign's `minScore` (pilot fallback) they turn `approved`, below they are skipped
 * with the score in the reason. Without this a scored row stays `pending` - invisible to the agenda,
 * blocking finalize - until the 24h discover cadence re-fires. Idempotent; caps at {@link GATHER_CAP}.
 */
export async function promoteScoredPendingJobs(
  { prisma, campaignJobs }: JobMutationDeps,
  userId: string,
  fallbackMinScore: number,
): Promise<void> {
  const rows = await prisma.job.findMany({
    where: {
      status: "pending",
      matchScore: { not: null },
      campaign: { userId, status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      matchScore: true,
      // The summary the promotion write derives is typed by the campaign's own source.
      campaign: { select: { config: true, source: true } },
    },
  });
  if (rows.length === 0) return;

  const batches = new Map<string, CampaignBatch>();

  for (const job of rows) {
    let batch = batches.get(job.campaignId);
    if (!batch) {
      batch = {
        source: job.campaign.source,
        threshold: resolveMinScore(job.campaign.config, fallbackMinScore),
        candidates: [],
      };
      batches.set(job.campaignId, batch);
    }
    batch.candidates.push({
      key: job.key,
      matchScore: job.matchScore ?? 0,
      threshold: batch.threshold,
    });
  }

  for (const [campaignId, batch] of batches) {
    await campaignJobs.promoteScoredJobs(userId, campaignId, batch.source, batch.candidates);
  }
}
