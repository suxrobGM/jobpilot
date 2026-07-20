import { resolveMinScore } from "./campaign-config";
import { GATHER_CAP } from "./constants";
import type { JobMutationDeps } from "./expiry";

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
      campaign: { userId, status: "in_progress", source: "auto-apply" },
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

  // Jobs of the same campaign share one threshold; parse each campaign's config at most once.
  const thresholdByCampaign = new Map<string, number>();
  // Sequential: recordJobResult opens an interactive transaction, so a whole discovery batch fired
  // at once would exhaust the Prisma pool (P2024) and race same-campaign summary recomputes.
  for (const job of rows) {
    let threshold = thresholdByCampaign.get(job.campaignId);
    if (threshold === undefined) {
      threshold = resolveMinScore(job.campaign.config, fallbackMinScore);
      thresholdByCampaign.set(job.campaignId, threshold);
    }
    const score = job.matchScore ?? 0;
    if (score >= threshold) {
      await campaignJobs.patchJob(userId, job.campaignId, job.key, { status: "approved" });
    } else {
      await campaignJobs.recordJobResult(userId, job.campaignId, job.key, {
        outcome: "skipped",
        skipReason: `Below minimum match score (${score} < ${threshold})`,
      });
    }
  }
}
