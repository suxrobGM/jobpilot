import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type CampaignJobStatus,
  type CampaignSource,
  type Job,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { deriveCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned, PROMOTABLE_SOURCES } from "../campaign.utils";
import { assertNotDuplicateApply, guardApply } from "./apply-guard";
import { publishJob, publishProgress, publishStatusChange } from "./job-events";
import { isTerminalJob, writeJobResult } from "./job-result";

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

interface JobTransition {
  from: CampaignJobStatus;
  /** A concurrent writer already landing here makes the command a no-op. */
  to: CampaignJobStatus;
  /** Status meaning the command already ran; null when a repeat must still write. */
  idempotentAt: CampaignJobStatus | null;
  data: Prisma.JobUpdateManyMutationInput;
  rejection: (status: CampaignJobStatus) => string;
}

interface TransitionResult {
  job: Job;
  changed: boolean;
}

export interface ScoredJobPromotion {
  key: string;
  matchScore: number;
  threshold: number;
}

@singleton()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listings: JobListingPublisher,
  ) {}

  async addJob(userId: string, campaignId: string, body: AddCampaignJobInput) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);

    const job = await this.prisma.job.create({
      data: { ...body, campaignId, status: body.status ?? "pending" },
    });

    this.listings.publishInBackground(job);
    publishJob(userId, job, "added");
    return job;
  }

  /** A field edit, moving the status too when the patch names a new one. Never idempotent. */
  async patchJob(userId: string, campaignId: string, key: string, patch: PatchCampaignJobInput) {
    const existing = await this.findJob(userId, campaignId, key);
    if (isTerminalJob(existing.status)) {
      throw conflict("Terminal jobs cannot be edited; use the retry or rescan command.");
    }
    const moveTo = patch.status && patch.status !== existing.status ? patch.status : null;
    if (moveTo && !ALLOWED_TRANSITIONS[existing.status].includes(moveTo)) {
      throw conflict(`Job cannot transition from ${existing.status} to ${moveTo}.`);
    }

    const { status: _, ...fields } = patch;
    const job = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction(async (tx) => {
        if (moveTo === "applying") {
          await assertNotDuplicateApply(tx, userId, existing);
        }
        if (moveTo) {
          const clearsOutcome = moveTo === "approved";
          const changed = await tx.job.updateMany({
            where: { campaignId, key, status: existing.status },
            data: {
              status: moveTo,
              ...(clearsOutcome && { appliedAt: null, failReason: null, skipReason: null }),
            },
          });
          if (changed.count === 0) throw conflict("Job status changed concurrently.");
        }
        return tx.job.update({ where: { campaignId_key: { campaignId, key } }, data: fields });
      }),
    );

    this.listings.publishInBackground(job);
    if (moveTo) {
      await publishStatusChange(this.prisma, userId, job, existing.campaign.source);
    } else {
      publishJob(userId, job, "updated");
    }
    return job;
  }

  /** The only way out of `failed`. */
  async retryJob(userId: string, campaignId: string, key: string, body: RetryCampaignJobInput) {
    const { job } = await this.applyTransition(userId, campaignId, key, {
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
    return job;
  }

  /**
   * Settles a failed job as skipped by the user, so the failed-jobs retry sweep stops picking it
   * up. The fail reason stays: it is why the user gave up on the job.
   */
  async skipFailedJob(userId: string, campaignId: string, key: string, skipReason: string) {
    const { job } = await this.applyTransition(userId, campaignId, key, {
      from: "failed",
      to: "skipped",
      idempotentAt: "skipped",
      data: { status: "skipped", skipReason },
      rejection: (status) => `Only failed jobs can be skipped this way; job is ${status}.`,
    });
    return job;
  }

  async rescanJob(userId: string, campaignId: string, key: string, body: RescanCampaignJobInput) {
    const { job, changed } = await this.applyTransition(userId, campaignId, key, {
      from: "skipped",
      to: body.decision,
      // A rescan of a still-skipped job must re-score it rather than short-circuit.
      idempotentAt: body.decision === "approved" ? "approved" : null,
      data: {
        status: body.decision,
        matchScore: body.matchScore,
        matchReason: body.matchReason,
        skipReason: body.decision === "skipped" ? body.skipReason : null,
        description: body.description,
        brief: body.brief,
      },
      rejection: (status) => `Only skipped jobs can be rescanned; job is ${status}.`,
    });
    // A rescan opens the posting, so it is often the first write carrying a publishable brief.
    if (changed) {
      this.listings.publishInBackground(job);
    }
    return job;
  }

  /** Settles scored `pending` rows into `approved` or `skipped` by the campaign's threshold. */
  async promoteScoredJobs(
    userId: string,
    campaignId: string,
    source: CampaignSource,
    candidates: ScoredJobPromotion[],
  ): Promise<void> {
    // One write per (outcome, score) rather than per row. Grouping by score keeps the `matchScore`
    // guard, which detects a concurrent rescore, exact under an `in` on keys.
    const groups = Map.groupBy(candidates, (c) => `${c.matchScore >= c.threshold}:${c.matchScore}`);

    const jobs = await this.prisma.$transaction(async (tx) => {
      const moved: Job[] = [];
      for (const group of groups.values()) {
        const { matchScore, threshold } = group[0];
        const approved = matchScore >= threshold;
        const updated = await tx.job.updateManyAndReturn({
          where: {
            campaignId,
            status: "pending",
            matchScore,
            key: { in: group.map((c) => c.key) },
            campaign: { userId, status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
          },
          data: approved
            ? { status: "approved" }
            : {
                status: "skipped",
                skipReason: `Below minimum match score (${matchScore} < ${threshold})`,
              },
        });
        moved.push(...updated);
      }
      return moved;
    });
    if (jobs.length === 0) return;

    for (const job of jobs) {
      publishJob(userId, job, "updated");
    }
    await publishProgress(this.prisma, campaignId, source);
  }

  async recordJobResult(
    userId: string,
    campaignId: string,
    key: string,
    data: CampaignJobResultInput,
  ) {
    const result = await writeJobResult(this.prisma, userId, campaignId, key, data);
    const summary = result.changed
      ? await publishStatusChange(this.prisma, userId, result.campaignJob, result.source)
      : await deriveCampaignSummary(this.prisma, campaignId, result.source);
    if (result.changed && result.application) {
      publish(workspaceChannel, { userId }, { type: "application.created", campaignId });
    }
    return { campaignJob: result.campaignJob, application: result.application, summary };
  }

  private findJob(userId: string, campaignId: string, key: string) {
    return findOwned(
      (where) =>
        this.prisma.job.findFirst({ where, include: { campaign: { select: { source: true } } } }),
      { campaignId, key, campaign: { userId } },
      "Campaign job",
    );
  }

  /** A guarded status transition that absorbs repeat commands and lost races as no-ops. */
  private async applyTransition(
    userId: string,
    campaignId: string,
    key: string,
    transition: JobTransition,
  ): Promise<TransitionResult> {
    const existing = await this.findJob(userId, campaignId, key);
    if (existing.status === transition.idempotentAt) {
      return { job: existing, changed: false };
    }
    if (existing.status !== transition.from) {
      throw conflict(transition.rejection(existing.status));
    }

    const changed = await this.prisma.job.updateMany({
      where: { campaignId, key, status: transition.from, campaign: { userId } },
      data: transition.data,
    });
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { campaignId_key: { campaignId, key } },
    });
    if (changed.count === 0) {
      if (job.status === transition.to) return { job, changed: false };
      throw conflict(`Job changed concurrently to ${job.status}.`);
    }

    await publishStatusChange(this.prisma, userId, job, existing.campaign.source);
    return { job, changed: true };
  }
}
