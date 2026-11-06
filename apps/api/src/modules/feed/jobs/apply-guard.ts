import { ErrorCodes } from "@jobpilot/contracts/errors";
import { AUTO_APPLY_FEED_KINDS } from "@jobpilot/contracts/feed";
import { z } from "zod/v4";
import { conflict, HttpError } from "@/common/errors";
import type { Job, Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  type AppliedDuplicate,
  type DuplicateReader,
  duplicateSkipReason,
  findAppliedDuplicate,
} from "@/modules/application/duplicate";
import { findFuzzyDuplicate } from "@/modules/scoring/applied-duplicates";
import { publishJob } from "./job-events";
import { JOB_INCLUDE, type JobRow } from "./job-row";

/** A live feed the pilot scores and applies from on its own. */
export const LIVE_AUTO_APPLY_FEED = {
  pausedAt: null,
  archivedAt: null,
  kind: { in: [...AUTO_APPLY_FEED_KINDS] },
} satisfies Prisma.FeedWhereInput;

type GuardReader = DuplicateReader & Pick<Prisma.TransactionClient, "job">;

export interface JobPosting {
  feedId: string;
  key: string;
  url: string;
  title: string;
  company: string;
}

/** A user never has more than a handful of applies open at once. */
const MAX_APPLYING = 100;

export class AlreadyAppliedError extends HttpError {
  constructor(
    readonly duplicate: AppliedDuplicate,
    readonly job: JobPosting,
    /** Whether the job was then recorded as skipped. */
    recorded = false,
  ) {
    const { title, company, appliedAt } = duplicate.application;
    const day = appliedAt.toISOString().slice(0, 10);
    const tail = recorded ? " The job has been recorded as skipped with this reason;" : "";
    super(
      ErrorCodes.ALREADY_APPLIED,
      `${duplicateSkipReason(duplicate)}: you applied to "${title}" at ${company} on ${day}.${tail} do not apply again.`,
      409,
    );
    this.name = "AlreadyAppliedError";
  }
}

/**
 * An `applying` sibling of the same posting. `Application` rows land only when the result is
 * recorded, so until then the applied-duplicate rule cannot see an apply in progress.
 */
async function findApplyingSibling(
  db: Pick<Prisma.TransactionClient, "job">,
  userId: string,
  job: JobPosting,
): Promise<JobPosting | null> {
  const others = await db.job.findMany({
    where: {
      status: "applying",
      userId,
      NOT: { feedId: job.feedId, key: job.key },
    },
    take: MAX_APPLYING,
    select: { feedId: true, key: true, url: true, title: true, company: true },
  });

  const sameUrl = others.find((other) => other.url === job.url);
  if (sameUrl) {
    return sameUrl;
  }

  return findFuzzyDuplicate(job, others)?.candidate ?? null;
}

/**
 * Refuses a move into `applying` for a posting the user already applied to or is applying to.
 * An applied duplicate throws `AlreadyAppliedError`, which `guardApply` turns into a skip; an
 * `applying` sibling only refuses, since that apply may still fail.
 */
export async function assertNotDuplicateApply(
  db: GuardReader,
  userId: string,
  job: JobPosting,
): Promise<void> {
  const sibling = await findApplyingSibling(db, userId, job);
  if (sibling) {
    throw conflict(
      `Already applying: another worker holds "${sibling.title}" at ${sibling.company} (${sibling.feedId}/${sibling.key}). Record this job as skipped with reason "Already applied (in-flight)" instead of applying alongside it.`,
      ErrorCodes.APPLY_IN_FLIGHT,
    );
  }

  const duplicate = await findAppliedDuplicate(db, userId, job);
  if (duplicate) {
    throw new AlreadyAppliedError(duplicate, job);
  }
}

/**
 * Runs a move into `applying`. On a duplicate the move has rolled back, so the job is skipped
 * here - otherwise it stays `approved` and the next task list offers the same duplicate again.
 */
export async function guardApply<T>(
  prisma: PrismaClient,
  userId: string,
  move: () => Promise<T>,
): Promise<T> {
  try {
    return await move();
  } catch (error) {
    if (!(error instanceof AlreadyAppliedError)) throw error;

    const { feedId, key } = error.job;
    const [skipped] = await prisma.job.updateManyAndReturn({
      where: { feedId, key, status: { in: ["approved", "needs_user"] } },
      data: { status: "skipped", skipReason: duplicateSkipReason(error.duplicate) },
      include: JOB_INCLUDE,
    });
    if (skipped) {
      publishJob(userId, skipped, "updated");
    }
    throw new AlreadyAppliedError(error.duplicate, error.job, skipped !== undefined);
  }
}

export type JobRef = Pick<Job, "feedId" | "key">;

const jobRefSchema = z.object({ feedId: z.string().min(1), jobKey: z.string().min(1) });

/** The job a `job.apply` run payload points at. */
export function parseJobRef(payload: unknown): JobRef {
  const { feedId, jobKey } = jobRefSchema.parse(payload);
  return { feedId, key: jobKey };
}

/** Hands `applying` jobs whose run ended without a result back to the queue. */
export async function revertApplyingJobs(
  tx: Prisma.TransactionClient,
  userId: string,
  jobs: JobRef[],
): Promise<void> {
  if (jobs.length === 0) return;
  await tx.job.updateMany({
    where: { status: "applying", userId, OR: jobs },
    data: { status: "approved" },
  });
}

/** Jobs ready to apply to: the pilot's `job.apply` gather and its run-start re-check share this. */
export function applyableJobWhere(userId: string) {
  return {
    status: "approved",
    userId,
    feed: { pausedAt: null, archivedAt: null },
  } satisfies Prisma.JobWhereInput;
}

/** Moves an approved job into `applying` inside the caller's transaction; wrap it in `guardApply`. */
export async function startApplying(
  tx: Prisma.TransactionClient,
  userId: string,
  feedId: string,
  key: string,
): Promise<JobRow> {
  const where = {
    ...applyableJobWhere(userId),
    feedId,
    key,
  } satisfies Prisma.JobWhereInput;

  const target = await tx.job.findFirst({
    where,
    select: { url: true, title: true, company: true },
  });
  if (!target) throw conflict("Job is no longer approved.");
  await assertNotDuplicateApply(tx, userId, { ...target, feedId, key });

  // An empty result is the lost race.
  const [started] = await tx.job.updateManyAndReturn({
    where,
    data: { status: "applying" },
    include: JOB_INCLUDE,
  });
  if (!started) throw conflict("Job is no longer approved.");
  return started;
}
