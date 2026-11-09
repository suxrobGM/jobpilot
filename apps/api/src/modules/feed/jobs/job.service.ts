import { ErrorCodes } from "@jobpilot/contracts/errors";
import type {
  AddJobInput,
  JobResultInput,
  PatchJobInput,
  RescanJobInput,
  RetryJobInput,
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
import { ensureFeedOwned } from "../feed-ownership";
import { assertNotDuplicateApply, guardApply, type JobPosting } from "./apply-guard";
import { LIVE_AUTO_APPLY_FEED } from "./applying";
import { publishJobAdded, publishJobApproved, publishJobUpdated } from "./job-events";
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

/** A job back in the approved queue carries no trace of an earlier outcome. */
const OUTCOME_CLEARED = { appliedAt: null, failReason: null, skipReason: null };

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

export interface ScoredJob {
  key: string;
  matchScore: number;
  threshold: number;
}

interface MovingJob extends JobPosting {
  status: JobStatus;
}

/** Guarded on the old status, so a concurrent move fails rather than being overwritten. */
export async function moveStatus(
  tx: Prisma.TransactionClient,
  userId: string,
  job: MovingJob,
  to: JobStatus,
): Promise<void> {
  if (to === "applying") {
    await assertNotDuplicateApply(tx, userId, job);
  }
  const { count } = await tx.job.updateMany({
    where: { feedId: job.feedId, key: job.key, status: job.status },
    data: { status: to, ...(to === "approved" && OUTCOME_CLEARED) },
  });
  if (count === 0) {
    throw conflict("Job status changed concurrently.");
  }
}

function settledData(matchScore: number, threshold: number): Prisma.JobUpdateManyMutationInput {
  if (matchScore >= threshold) {
    return { status: "approved" };
  }
  return {
    status: "skipped",
    skipReason: `Below minimum match score (${matchScore} < ${threshold})`,
  };
}

@injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly listings = inject(JobListingPublisher),
    private readonly boards = inject(JobBoardService),
  ) {}

  /** A posting the user already has from the window comes back as that row, flagged `duplicate`. */
  async add(userId: string, feedId: string, body: AddJobInput) {
    await ensureFeedOwned(this.prisma, userId, feedId);

    const url = normalizeJobUrl(body.url);
    const existing = await this.prisma.job.findFirst({
      where: recentPostingsWhere(userId, [url]),
      orderBy: { createdAt: "desc" },
      include: JOB_INCLUDE,
    });
    if (existing) {
      return { ...toJob(existing), duplicate: true };
    }

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
    publishJobAdded(userId, job);
    return { ...toJob(job), duplicate: false };
  }

  async get(userId: string, feedId: string, key: string) {
    return toJob(await this.findJob(userId, feedId, key));
  }

  /** A field edit, moving the status too when the patch names a new one. Never idempotent. */
  async update(userId: string, feedId: string, key: string, patch: PatchJobInput) {
    const existing = await this.findJob(userId, feedId, key);
    if (isTerminalJob(existing.status)) {
      throw conflict("Terminal jobs cannot be edited; use the retry or rescan command.");
    }
    const moveTo = patch.status && patch.status !== existing.status ? patch.status : null;
    if (moveTo && !ALLOWED_TRANSITIONS[existing.status].includes(moveTo)) {
      throw conflict(`Job cannot transition from ${existing.status} to ${moveTo}.`);
    }

    const { status: _, board, ...fields } = patch;
    const boardField = await this.boardChange(existing, board);
    const job = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction(async (tx) => {
        if (moveTo) {
          await moveStatus(tx, userId, existing, moveTo);
        }
        return tx.job.update({
          where: { feedId_key: { feedId, key } },
          data: { ...fields, brief: toNullableInputJson(fields.brief), ...boardField },
          include: JOB_INCLUDE,
        });
      }),
    );

    this.listings.publishInBackground(job);
    publishJobUpdated(userId, job);
    if (moveTo === "approved") {
      publishJobApproved(userId, job);
    }
    return toJob(job);
  }

  /** The only way out of `failed`. */
  async retry(userId: string, feedId: string, key: string, body: RetryJobInput) {
    const { job, changed } = await this.transition(userId, feedId, key, {
      from: "failed",
      to: "approved",
      idempotentAt: "approved",
      data: { status: "approved", ...OUTCOME_CLEARED, retryNotes: body.retryNotes },
      rejection: (status) => `Only failed jobs can be retried; job is ${status}.`,
    });
    if (changed) {
      publishJobApproved(userId, job);
    }
    return toJob(job);
  }

  async rescan(userId: string, feedId: string, key: string, body: RescanJobInput) {
    const { job, changed } = await this.transition(userId, feedId, key, {
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
  async settleScored(userId: string, feedId: string, scored: ScoredJob[]): Promise<void> {
    // One write per (outcome, score) rather than per row. Grouping by score keeps the `matchScore`
    // guard, which detects a concurrent rescore, exact under an `in` on keys.
    const groups = Map.groupBy(
      scored,
      (job) => `${job.matchScore >= job.threshold}:${job.matchScore}`,
    );

    const settled = await this.prisma.$transaction(async (tx) => {
      const moved: JobRow[] = [];
      for (const group of groups.values()) {
        const { matchScore, threshold } = group[0];
        const updated = await tx.job.updateManyAndReturn({
          where: {
            feedId,
            status: "pending",
            matchScore,
            key: { in: group.map((job) => job.key) },
            userId,
            feed: LIVE_AUTO_APPLY_FEED,
          },
          data: settledData(matchScore, threshold),
          include: JOB_INCLUDE,
        });
        moved.push(...updated);
      }
      return moved;
    });
    for (const job of settled) {
      publishJobUpdated(userId, job);
    }
  }

  async recordResult(userId: string, feedId: string, key: string, data: JobResultInput) {
    const result = await writeJobResult(this.prisma, userId, feedId, key, data);
    if (result.changed) {
      publishJobUpdated(userId, result.job);
      if (result.application) {
        publish(workspaceChannel, { userId }, { type: "application.created", feedId });
      }
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

  /** An absent or unchanged `board` leaves the column alone; null clears it. */
  private async boardChange(existing: JobRow, board: PatchJobInput["board"]) {
    if (board === undefined || board === existing.board?.domain) {
      return {};
    }
    return { boardId: await this.boards.resolveId(board) };
  }

  /** A guarded status transition that absorbs repeat commands and lost races as no-ops. */
  private async transition(
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
      if (job.status === transition.to) {
        return { job, changed: false };
      }
      throw conflict(`Job changed concurrently to ${job.status}.`);
    }

    publishJobUpdated(userId, job);
    return { job, changed: true };
  }
}
