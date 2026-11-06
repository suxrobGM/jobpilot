import { ErrorCodes } from "@jobpilot/contracts/errors";
import {
  type AddJobInput,
  AUTO_APPLY_FEED_KINDS,
  type JobResultInput,
  type PatchJobInput,
  type RescanJobInput,
  type RetryJobInput,
} from "@jobpilot/contracts/feed";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, isPrismaError, PRISMA_ERRORS } from "@/common/errors";
import { toNullableInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import { normalizeJobUrl } from "@/common/utils/url";
import { type JobStatus, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { JobBoardService } from "@/modules/job-board/job-board.service";
import { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { ensureFeedOwned } from "../feed.utils";
import { assertNotDuplicateApply, guardApply } from "./apply-guard";
import { publishJob } from "./job-events";
import { isTerminalJob, writeJobResult } from "./job-result";
import { JOB_INCLUDE, type JobRow, toJob } from "./job-row";
import { recentPostingsWhere } from "./recent-postings";

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
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
  from: JobStatus;
  /** A concurrent writer already landing here makes the command a no-op. */
  to: JobStatus;
  /** Status meaning the command already ran; null when a repeat must still write. */
  idempotentAt: JobStatus | null;
  data: Prisma.JobUpdateManyMutationInput;
  rejection: (status: JobStatus) => string;
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
export class JobService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly listings = inject(JobListingPublisher),
    private readonly boards = inject(JobBoardService),
  ) {}

  /** A posting the user already has from the window comes back as that row, flagged `duplicate`. */
  async addJob(userId: string, feedId: string, body: AddJobInput) {
    await ensureFeedOwned(this.prisma, userId, feedId);

    const url = normalizeJobUrl(body.url);
    const existing = await this.prisma.job.findFirst({
      where: recentPostingsWhere(userId, [url]),
      orderBy: { createdAt: "desc" },
      include: JOB_INCLUDE,
    });
    if (existing) return { ...toJob(existing), duplicate: true };

    const { board, ...fields } = body;
    const boardId = await this.boards.resolveId(board ?? null);
    let job: JobRow;
    try {
      job = await this.prisma.job.create({
        data: {
          ...fields,
          brief: toNullableInputJson(fields.brief),
          boardId,
          url,
          feedId,
          userId,
          status: body.status ?? "pending",
        },
        include: JOB_INCLUDE,
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) {
        throw conflict(`The feed already has job "${body.key}".`, ErrorCodes.DUPLICATE_JOB);
      }
      throw error;
    }

    this.listings.publishInBackground(job);
    publishJob(userId, job, "added");
    return { ...toJob(job), duplicate: false };
  }

  /** A field edit, moving the status too when the patch names a new one. Never idempotent. */
  async patchJob(userId: string, feedId: string, key: string, patch: PatchJobInput) {
    const existing = await this.findJob(userId, feedId, key);
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
          const changed = await tx.job.updateMany({
            where: { feedId, key, status: existing.status },
            data: {
              status: moveTo,
              ...(clearsOutcome && { appliedAt: null, failReason: null, skipReason: null }),
            },
          });
          if (changed.count === 0) throw conflict("Job status changed concurrently.");
        }
        return tx.job.update({
          where: { feedId_key: { feedId, key } },
          data: { ...fields, brief: toNullableInputJson(fields.brief), ...boardField },
          include: JOB_INCLUDE,
        });
      }),
    );

    this.listings.publishInBackground(job);
    publishJob(userId, job, "updated");
    return toJob(job);
  }

  /** The only way out of `failed`. */
  async retryJob(userId: string, feedId: string, key: string, body: RetryJobInput) {
    const { job } = await this.applyTransition(userId, feedId, key, {
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
    return toJob(job);
  }

  async rescanJob(userId: string, feedId: string, key: string, body: RescanJobInput) {
    const { job, changed } = await this.applyTransition(userId, feedId, key, {
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
    return toJob(job);
  }

  /** Settles scored `pending` rows into `approved` or `skipped` by the feed's threshold. */
  async promoteScoredJobs(
    userId: string,
    feedId: string,
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
        const updated = await tx.job.updateManyAndReturn({
          where: {
            feedId,
            status: "pending",
            matchScore,
            key: { in: group.map((c) => c.key) },
            userId,
            feed: { pausedAt: null, archivedAt: null, kind: { in: [...AUTO_APPLY_FEED_KINDS] } },
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
  }

  async recordJobResult(userId: string, feedId: string, key: string, data: JobResultInput) {
    const result = await writeJobResult(this.prisma, userId, feedId, key, data);
    if (result.changed) {
      publishJob(userId, result.job, "updated");
    }
    if (result.changed && result.application) {
      publish(workspaceChannel, { userId }, { type: "application.created", feedId });
    }
    return { job: toJob(result.job), application: result.application };
  }

  private findJob(userId: string, feedId: string, key: string) {
    return findOwned(
      (where) => this.prisma.job.findFirst({ where, include: JOB_INCLUDE }),
      { feedId, key, userId },
      "Feed job",
    );
  }

  /** A guarded status transition that absorbs repeat commands and lost races as no-ops. */
  private async applyTransition(
    userId: string,
    feedId: string,
    key: string,
    transition: JobTransition,
  ): Promise<TransitionResult> {
    const existing = await this.findJob(userId, feedId, key);
    if (existing.status === transition.idempotentAt) {
      return { job: existing, changed: false };
    }
    if (existing.status !== transition.from) {
      throw conflict(transition.rejection(existing.status));
    }

    const changed = await this.prisma.job.updateMany({
      where: { feedId, key, status: transition.from, userId },
      data: transition.data,
    });
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { feedId_key: { feedId, key } },
      include: JOB_INCLUDE,
    });
    if (changed.count === 0) {
      if (job.status === transition.to) return { job, changed: false };
      throw conflict(`Job changed concurrently to ${job.status}.`);
    }

    publishJob(userId, job, "updated");
    return { job, changed: true };
  }
}
