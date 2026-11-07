import { feedConfigSchema } from "@jobpilot/contracts/feed";
import { DAY_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { LIVE_AUTO_APPLY_FEED, revertApplyingJobs } from "@/modules/feed/jobs/applying";
import type { JobService } from "@/modules/feed/jobs/job.service";
import { parseJobRef, parseJobSubject } from "../job-subject";
import { finishRequests } from "../requests/request-row";
import { GATHER_CAP } from "../runs/run-history";
import { SERVER_SKIP_REASONS } from "../skip-reasons";

/** An `applying` job with no open run and no update for this long lost its driver. */
const STALE_APPLYING_MS = 30 * 60 * 1000;
/** A week-long pause would otherwise wake to dead postings ranked above everything else. */
const APPROVED_JOB_STALE_MS = 7 * DAY_MS;
const MAX_OPEN_APPLY_RUNS = 20;

function staleApplyingBefore(now: Date): Date {
  return new Date(now.getTime() - STALE_APPLYING_MS);
}

/** Ends runs past their expiry and hands the jobs they, or a crashed terminal, left `applying` back. */
async function expireRuns(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const expiredRuns = await tx.pilotRun.findMany({
    where: { userId, finishedAt: null, expiresAt: { lt: now } },
    take: GATHER_CAP,
    select: { id: true, taskType: true, payload: true },
  });
  if (expiredRuns.length > 0) {
    const runIds = expiredRuns.map((run) => run.id);
    await tx.pilotRun.updateMany({
      where: { id: { in: runIds }, finishedAt: null },
      data: { finishedAt: now, outcome: "expired" },
    });
    await finishRequests(tx, runIds, "expired", now);
    const jobs = expiredRuns
      .filter((run) => run.taskType === "job.apply")
      .map((run) => parseJobRef(run.payload));
    await revertApplyingJobs(tx, userId, jobs);
  }

  // A crashed terminal apply takes no run, so its job would stay `applying` and block finalize.
  const openApplyRuns = await tx.pilotRun.findMany({
    where: { userId, taskType: "job.apply", finishedAt: null, expiresAt: { gte: now } },
    take: MAX_OPEN_APPLY_RUNS,
    select: { payload: true },
  });
  await tx.job.updateMany({
    where: {
      status: "applying",
      userId,
      updatedAt: { lt: staleApplyingBefore(now) },
      NOT: openApplyRuns.map((run) => parseJobRef(run.payload)),
    },
    data: { status: "approved" },
  });
}

/**
 * {@link expireRuns} for every user, so a stopped pilot's runs still end and its jobs leave
 * `applying`. Nothing else: the rest of {@link expireStaleWork} reshapes a queue only a running pilot owns.
 */
export async function expireAbandonedRuns(prisma: PrismaClient, now: Date): Promise<number> {
  const [withRuns, withJobs] = await Promise.all([
    prisma.pilotRun.findMany({
      where: { finishedAt: null, expiresAt: { lt: now } },
      distinct: ["userId"],
      take: GATHER_CAP,
      select: { userId: true },
    }),
    prisma.feed.findMany({
      where: {
        jobs: {
          some: {
            status: "applying",
            updatedAt: { lt: staleApplyingBefore(now) },
          },
        },
      },
      distinct: ["userId"],
      take: GATHER_CAP,
      select: { userId: true },
    }),
  ]);
  const userIds = new Set([...withRuns, ...withJobs].map((row) => row.userId));
  for (const userId of userIds) {
    await prisma.$transaction((tx) => expireRuns(tx, userId, now));
  }
  return userIds.size;
}

/** Expires open questions past their date and skips the jobs they parked in `needs_user`. */
async function expireQuestions(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const expired = await tx.pilotQuestion.findMany({
    where: { userId, status: "open", expiresAt: { lt: now } },
    take: GATHER_CAP,
    select: { id: true, subjectType: true, subjectId: true },
  });
  if (expired.length === 0) {
    return;
  }

  await tx.pilotQuestion.updateMany({
    where: { id: { in: expired.map((question) => question.id) }, status: "open" },
    data: { status: "expired" },
  });
  const parkedJobs = expired.flatMap((question) =>
    question.subjectType === "job" && question.subjectId
      ? [parseJobSubject(question.subjectId)]
      : [],
  );
  if (parkedJobs.length === 0) {
    return;
  }

  await tx.job.updateMany({
    where: { status: "needs_user", userId, OR: parkedJobs },
    data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.unanswered },
  });
}

/** Expires runs and questions, and returns what they held to a workable state. */
export async function expireStaleWork(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await expireRuns(tx, userId, now);
    // Pilot feeds only: a user's own queue is theirs to clear.
    await tx.job.updateMany({
      where: {
        status: "approved",
        userId,
        feed: { createdBy: "pilot" },
        createdAt: { lt: new Date(now.getTime() - APPROVED_JOB_STALE_MS) },
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.wentStale },
    });
    await expireQuestions(tx, userId, now);
  });
}

/** Settles scored pending jobs now instead of waiting for the next discovery run. */
export async function settleScoredJobs(
  prisma: PrismaClient,
  jobService: JobService,
  userId: string,
  fallbackMinScore: number,
): Promise<void> {
  const rows = await prisma.job.findMany({
    where: {
      status: "pending",
      matchScore: { not: null },
      userId,
      feed: LIVE_AUTO_APPLY_FEED,
    },
    take: GATHER_CAP,
    select: {
      feedId: true,
      key: true,
      matchScore: true,
      feed: { select: { config: true } },
    },
  });

  for (const [feedId, jobs] of Map.groupBy(rows, (row) => row.feedId)) {
    const { config } = jobs[0].feed;
    const threshold = feedConfigSchema.parse(config).minScore ?? fallbackMinScore;
    const scored = jobs.map((job) => ({
      key: job.key,
      matchScore: job.matchScore ?? 0,
      threshold,
    }));
    await jobService.settleScored(userId, feedId, scored);
  }
}
