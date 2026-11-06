import { CAMPAIGN_JOB_ACTIVE_STATUSES, campaignConfigSchema } from "@jobpilot/contracts/campaign";
import { DAY_MS } from "@/common/date/buckets";
import type { CampaignFeed, Prisma, PrismaClient } from "@/generated/prisma/client";
import { PROMOTABLE_SOURCES, publishCampaignStatus } from "@/modules/campaign/campaign.utils";
import { parseJobRef, revertApplyingJobs } from "@/modules/campaign/jobs/apply-guard";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotJournalService } from "../journal.service";
import { finishRequests } from "../requests/request-row";
import { SERVER_SKIP_REASONS } from "../skip-reasons";
import { GATHER_CAP, parseJobSubject } from "./run-history";

/** An `applying` job with no open run and no update for this long lost its driver. */
const STALE_APPLYING_MS = 30 * 60 * 1000;
/** A week-long pause would otherwise wake to dead postings ranked above everything else. */
const APPROVED_JOB_STALE_MS = 7 * DAY_MS;
/** Recent job activity means someone may be mid-session on the campaign. */
const FINALIZE_IDLE_MS = 10 * 60 * 1000;
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
  await tx.campaignJob.updateMany({
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
 * `applying`. Nothing else: the rest of {@link runExpiry} reshapes a queue only a running pilot owns.
 */
export async function expireAbandonedRuns(prisma: PrismaClient, now: Date): Promise<number> {
  const [withRuns, withJobs] = await Promise.all([
    prisma.pilotRun.findMany({
      where: { finishedAt: null, expiresAt: { lt: now } },
      distinct: ["userId"],
      take: GATHER_CAP,
      select: { userId: true },
    }),
    prisma.campaign.findMany({
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

/** Expires runs and questions, and returns what they held to a workable state. */
export async function runExpiry(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await expireRuns(tx, userId, now);

    // Pilot campaigns only: a user's own queue is theirs to clear.
    await tx.campaignJob.updateMany({
      where: {
        status: "approved",
        userId,
        campaign: { createdBy: "pilot" },
        createdAt: { lt: new Date(now.getTime() - APPROVED_JOB_STALE_MS) },
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.wentStale },
    });

    const expiredQuestions = await tx.pilotQuestion.findMany({
      where: { userId, status: "open", expiresAt: { not: null, lt: now } },
      take: GATHER_CAP,
      select: { id: true, subjectType: true, subjectId: true },
    });
    if (expiredQuestions.length === 0) return;

    await tx.pilotQuestion.updateMany({
      where: { id: { in: expiredQuestions.map((question) => question.id) }, status: "open" },
      data: { status: "expired" },
    });
    const parkedJobs = expiredQuestions.flatMap((question) =>
      question.subjectType === "job" && question.subjectId
        ? [parseJobSubject(question.subjectId)]
        : [],
    );
    if (parkedJobs.length === 0) return;

    await tx.campaignJob.updateMany({
      where: {
        status: "needs_user",
        userId,
        OR: parkedJobs,
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.unanswered },
    });
  });
}

/** Settles scored pending jobs now instead of waiting for the next discovery run. */
export async function promoteScoredPendingJobs(
  prisma: PrismaClient,
  campaignJobs: CampaignJobService,
  userId: string,
  fallbackMinScore: number,
): Promise<void> {
  const rows = await prisma.campaignJob.findMany({
    where: {
      status: "pending",
      matchScore: { not: null },
      userId,
      campaign: { status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      matchScore: true,
      campaign: { select: { config: true, source: true } },
    },
  });

  for (const [campaignId, jobs] of Map.groupBy(rows, (row) => row.campaignId)) {
    const { config, source } = jobs[0].campaign;
    const threshold = campaignConfigSchema.parse(config).minScore ?? fallbackMinScore;
    const candidates = jobs.map((job) => ({
      key: job.key,
      matchScore: job.matchScore ?? 0,
      threshold,
    }));
    await campaignJobs.promoteScoredJobs(userId, campaignId, source, candidates);
  }
}

/** Server-side because as a task it starved forever. Standing campaigns of live feeds stay open. */
export async function finalizeIdleCampaigns(
  prisma: PrismaClient,
  journal: PilotJournalService,
  userId: string,
  now: Date,
  liveFeeds: CampaignFeed[],
): Promise<void> {
  const idle = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      pilotSearchId: null,
      // Not `NOT { feed: { in } }`: that is NULL in SQL for feedless rows.
      AND: [{ OR: [{ feed: null }, { feed: { notIn: liveFeeds } }] }],
      jobs: { none: { updatedAt: { gt: new Date(now.getTime() - FINALIZE_IDLE_MS) } } },
      OR: [
        {
          source: { not: "networking" },
          jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
        },
        {
          source: "networking",
          networkingMessages: { none: { status: { in: ["draft", "approved"] } } },
        },
      ],
    },
    select: { id: true },
  });
  if (idle.length === 0) return;

  // Guarded on status, so a concurrent transition wins over the sweep.
  const completed = await prisma.campaign.updateManyAndReturn({
    where: { id: { in: idle.map((campaign) => campaign.id) }, userId, status: "in_progress" },
    data: {
      status: "completed",
      statusChangedBy: "pilot",
      statusReason: "No active work remaining.",
      completedAt: now,
    },
    select: { id: true, query: true, source: true },
  });
  if (completed.length === 0) return;

  for (const campaign of completed) publishCampaignStatus(userId, campaign, "completed");
  await journal.appendJournal(userId, {
    entries: completed.map((campaign) => ({
      kind: "action" as const,
      subjectType: "campaign",
      subjectId: campaign.id,
      summary: `Finished the search '${campaign.query}' - nothing left to do.`,
    })),
  });
}
