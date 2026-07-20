import { resolveMinScore } from "@/modules/campaign/campaign.config";
import { GATHER_CAP } from "./constants";
import type { JobMutationDeps } from "./job-mutations";

/**
 * Promote already-scored pending jobs of in-progress auto-apply campaigns before the gathers, so a
 * fresh score decides the job in the same compile: at/above the threshold it becomes `approved` (and
 * surfaces as apply work this cycle); below, it is skipped with the score in the reason. The threshold
 * is the campaign's own `minScore`, falling back to the pilot's. Without this a scored-but-pending row
 * stays `pending` (an active status) - invisible to the agenda and blocking finalize - until the 24h
 * discover cadence re-fires. Idempotent (only touches `pending` rows); capped at {@link GATHER_CAP}.
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
      campaign: { userId, status: "in_progress", source: "auto_apply" },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      matchScore: true,
      campaign: { select: { config: true } },
    },
  });
  if (rows.length === 0) return;

  const batches = new Map<string, { key: string; matchScore: number; threshold: number }[]>();
  const thresholdByCampaign = new Map<string, number>();
  for (const job of rows) {
    let threshold = thresholdByCampaign.get(job.campaignId);
    if (threshold === undefined) {
      threshold = resolveMinScore(job.campaign.config, fallbackMinScore);
      thresholdByCampaign.set(job.campaignId, threshold);
    }
    const score = job.matchScore ?? 0;
    const batch = batches.get(job.campaignId) ?? [];
    batch.push({ key: job.key, matchScore: score, threshold });
    batches.set(job.campaignId, batch);
  }
  for (const [campaignId, candidates] of batches) {
    await campaignJobs.promoteScoredJobs(userId, campaignId, candidates);
  }
}
