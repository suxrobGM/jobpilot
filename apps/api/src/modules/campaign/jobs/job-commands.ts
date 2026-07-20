import type { RescanCampaignJobInput, RetryCampaignJobInput } from "@jobpilot/contracts/campaign";
import { conflict, findOwned } from "@/common/errors";
import type { CampaignJobStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { deriveCampaignSummary } from "../campaign.summary";

async function findJob(prisma: PrismaClient, userId: string, campaignId: string, key: string) {
  return findOwned(
    (where) => prisma.job.findFirst({ where, include: { campaign: { select: { source: true } } } }),
    { campaignId, key, campaign: { userId } },
    "Campaign job",
  );
}

interface JobTransition {
  /** The only status the job may hold for this command to apply. */
  from: CampaignJobStatus;
  /** Status the job settles into; a concurrent writer landing here makes the command a no-op. */
  to: CampaignJobStatus;
  /** Pre-existing status that means the command already ran. Null when it can never be a no-op —
   * a rescan of a still-skipped job must re-score it rather than short-circuit. */
  idempotentAt: CampaignJobStatus | null;
  data: Prisma.JobUpdateManyMutationInput;
  rejection: (status: CampaignJobStatus) => string;
}

/** Applies a guarded status transition, absorbing repeat commands and lost races idempotently.
 * Returns the campaign summary on a real change so callers can publish live totals. */
async function applyJobTransition(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  transition: JobTransition,
) {
  const existing = await findJob(prisma, userId, campaignId, key);
  if (existing.status === transition.idempotentAt) {
    return { job: existing, changed: false, summary: null };
  }
  if (existing.status !== transition.from) throw conflict(transition.rejection(existing.status));

  const changed = await prisma.job.updateMany({
    where: { campaignId, key, status: transition.from, campaign: { userId } },
    data: transition.data,
  });
  const job = await prisma.job.findUniqueOrThrow({
    where: { campaignId_key: { campaignId, key } },
  });
  if (changed.count === 0) {
    if (job.status === transition.to) return { job, changed: false, summary: null };
    throw conflict(`Job changed concurrently to ${job.status}.`);
  }
  return {
    job,
    changed: true,
    summary: await deriveCampaignSummary(prisma, campaignId, existing.campaign.source),
  };
}

/** Conditionally requeues a failed job; repeated successful commands are idempotent. */
export async function writeJobRetry(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  body: RetryCampaignJobInput,
) {
  return applyJobTransition(prisma, userId, campaignId, key, {
    from: "failed",
    to: "approved",
    idempotentAt: "approved",
    data: {
      status: "approved",
      appliedAt: null,
      failReason: null,
      skipReason: null,
      retryNotes: body.retryNotes,
    },
    rejection: (status) => `Only failed jobs can be retried; job is ${status}.`,
  });
}

/** Records a fresh skipped-job rescan and its explicit decision. */
export async function writeJobRescan(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  body: RescanCampaignJobInput,
) {
  return applyJobTransition(prisma, userId, campaignId, key, {
    from: "skipped",
    to: body.decision,
    idempotentAt: body.decision === "approved" ? "approved" : null,
    data: {
      status: body.decision,
      matchScore: body.matchScore,
      matchReason: body.matchReason,
      skipReason: body.decision === "skipped" ? body.skipReason : null,
      description: body.description,
      digest: body.digest,
    },
    rejection: (status) => `Only skipped jobs can be rescanned; job is ${status}.`,
  });
}
