import type {
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { conflict, findOwned } from "@/common/errors";
import type { CampaignJobStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { deriveCampaignSummary } from "../campaign.summary";
import { assertNotAlreadyApplied } from "./applied-guard";
import { isTerminalJob } from "./job-result";

const ALLOWED_TRANSITIONS: Record<CampaignJobStatus, readonly CampaignJobStatus[]> = {
  // A score pass promotes a pasted link into the normal pipeline; nothing ever moves back to queued.
  queued: ["pending"],
  pending: ["approved"],
  approved: ["pending", "applying"],
  applying: ["approved", "needs_user"],
  needs_user: ["approved", "applying"],
  applied: [],
  failed: [],
  skipped: [],
};

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
  /** Pre-existing status that means the command already ran. Null when it can never be a no-op -
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

/**
 * Applies a field edit, moving the job's status too when the patch names a new one. Unlike the
 * retry/rescan commands this is never idempotent: the caller asked for these exact field values.
 */
export async function writeJobPatch(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  patch: PatchCampaignJobInput,
) {
  const existing = await findJob(prisma, userId, campaignId, key);
  if (isTerminalJob(existing.status)) {
    throw conflict("Terminal jobs cannot be edited; use the retry or rescan command.");
  }

  const moveTo = patch.status && patch.status !== existing.status ? patch.status : null;
  if (moveTo && !ALLOWED_TRANSITIONS[existing.status].includes(moveTo)) {
    throw conflict(`Job cannot transition from ${existing.status} to ${moveTo}.`);
  }

  const job = await prisma.$transaction(async (tx) => {
    if (moveTo) {
      if (moveTo === "applying") {
        await assertNotAlreadyApplied(tx, userId, existing);
      }
      const changed = await tx.job.updateMany({
        where: { campaignId, key, status: existing.status },
        data: {
          status: moveTo,
          appliedAt: moveTo === "approved" ? null : undefined,
          failReason: moveTo === "approved" ? null : undefined,
          skipReason: moveTo === "approved" ? null : undefined,
        },
      });
      if (changed.count === 0) throw conflict("Job status changed concurrently.");
    }
    return tx.job.update({
      where: { campaignId_key: { campaignId, key } },
      data: {
        title: patch.title,
        company: patch.company,
        location: patch.location,
        salary: patch.salary,
        type: patch.type,
        board: patch.board,
        retryNotes: patch.retryNotes,
        matchScore: patch.matchScore,
        matchReason: patch.matchReason,
        description: patch.description,
        digest: patch.digest,
      },
    });
  });

  return {
    job,
    changed: true,
    summary: moveTo
      ? await deriveCampaignSummary(prisma, campaignId, existing.campaign.source)
      : null,
  };
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
