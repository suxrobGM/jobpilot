import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { ErrorCodes } from "@jobpilot/contracts/errors";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, isPrismaError, PRISMA_ERRORS } from "@/common/errors";
import { toNullableInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import { normalizeJobUrl } from "@/common/utils/url";
import {
  type CampaignJobStatus,
  type CampaignSource,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { JobBoardService } from "@/modules/job-board/job-board.service";
import { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { deriveCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned, PROMOTABLE_SOURCES } from "../campaign.utils";
import { assertNotDuplicateApply, guardApply } from "./apply-guard";
import { publishJob, publishProgress, publishStatusChange } from "./job-events";
import { isTerminalJob, writeJobResult } from "./job-result";
import { JOB_INCLUDE, type JobRow, toCampaignJob } from "./job-row";
import { recentPostingsWhere } from "./recent-postings";

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
  data: Prisma.CampaignJobUpdateManyMutationInput;
  rejection: (status: CampaignJobStatus) => string;
}

interface TransitionResult {
  job: JobRow;
  changed: boolean;
}

export interface ScoredJobPromotion {
  key: string;
  matchScore: number;
  threshold: number;
}

@injectable()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly listings = inject(JobListingPublisher),
    private readonly boards = inject(JobBoardService),
  ) {}

  /** A posting the user already has from the window comes back as that row, flagged `duplicate`. */
  async addJob(userId: string, campaignId: string, body: AddCampaignJobInput) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);

    const url = normalizeJobUrl(body.url);
    const existing = await this.prisma.campaignJob.findFirst({
      where: recentPostingsWhere(userId, [url]),
      orderBy: { createdAt: "desc" },
      include: JOB_INCLUDE,
    });
    if (existing) return { ...toCampaignJob(existing), duplicate: true };

    const { board, ...fields } = body;
    const boardId = await this.boards.resolveId(board ?? null);
    let job: JobRow;
    try {
      job = await this.prisma.campaignJob.create({
        data: {
          ...fields,
          brief: toNullableInputJson(fields.brief),
          boardId,
          url,
          campaignId,
          userId,
          status: body.status ?? "pending",
        },
        include: JOB_INCLUDE,
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) {
        throw conflict(`The campaign already has job "${body.key}".`, ErrorCodes.DUPLICATE_JOB);
      }
      throw error;
    }

    this.listings.publishInBackground(job);
    publishJob(userId, job, "added");
    return { ...toCampaignJob(job), duplicate: false };
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

    const { status: _, board, ...fields } = patch;
    // An absent or unchanged `board` leaves the column alone; null clears it.
    const keepsBoard = board === undefined || board === existing.board?.domain;
    const boardField = keepsBoard ? {} : { boardId: await this.boards.resolveId(board) };
    const job = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction(async (tx) => {
        if (moveTo === "applying") {
          await assertNotDuplicateApply(tx, userId, existing);
        }
        if (moveTo) {
          const clearsOutcome = moveTo === "approved";
          const changed = await tx.campaignJob.updateMany({
            where: { campaignId, key, status: existing.status },
            data: {
              status: moveTo,
              ...(clearsOutcome && { appliedAt: null, failReason: null, skipReason: null }),
            },
          });
          if (changed.count === 0) throw conflict("Job status changed concurrently.");
        }
        return tx.campaignJob.update({
          where: { campaignId_key: { campaignId, key } },
          data: { ...fields, brief: toNullableInputJson(fields.brief), ...boardField },
          include: JOB_INCLUDE,
        });
      }),
    );

    this.listings.publishInBackground(job);
    if (moveTo) {
      await publishStatusChange(this.prisma, userId, job, existing.campaign.source);
    } else {
      publishJob(userId, job, "updated");
    }
    return toCampaignJob(job);
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
    return toCampaignJob(job);
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
        brief: toNullableInputJson(body.brief),
      },
      rejection: (status) => `Only skipped jobs can be rescanned; job is ${status}.`,
    });
    // A rescan opens the posting, so it is often the first write carrying a publishable brief.
    if (changed) {
      this.listings.publishInBackground(job);
    }
    return toCampaignJob(job);
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
      const moved: JobRow[] = [];
      for (const group of groups.values()) {
        const { matchScore, threshold } = group[0];
        const approved = matchScore >= threshold;
        const updated = await tx.campaignJob.updateManyAndReturn({
          where: {
            campaignId,
            status: "pending",
            matchScore,
            key: { in: group.map((c) => c.key) },
            userId,
            campaign: { status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
          },
          data: approved
            ? { status: "approved" }
            : {
                status: "skipped",
                skipReason: `Below minimum match score (${matchScore} < ${threshold})`,
              },
          include: JOB_INCLUDE,
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
    return {
      campaignJob: toCampaignJob(result.campaignJob),
      application: result.application,
      summary,
    };
  }

  private findJob(userId: string, campaignId: string, key: string) {
    return findOwned(
      (where) =>
        this.prisma.campaignJob.findFirst({
          where,
          include: { ...JOB_INCLUDE, campaign: { select: { source: true } } },
        }),
      { campaignId, key, userId },
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

    const changed = await this.prisma.campaignJob.updateMany({
      where: { campaignId, key, status: transition.from, userId },
      data: transition.data,
    });
    const job = await this.prisma.campaignJob.findUniqueOrThrow({
      where: { campaignId_key: { campaignId, key } },
      include: JOB_INCLUDE,
    });
    if (changed.count === 0) {
      if (job.status === transition.to) return { job, changed: false };
      throw conflict(`Job changed concurrently to ${job.status}.`);
    }

    await publishStatusChange(this.prisma, userId, job, existing.campaign.source);
    return { job, changed: true };
  }
}
