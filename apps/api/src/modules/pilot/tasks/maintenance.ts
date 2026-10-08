import { CAMPAIGN_JOB_ACTIVE_STATUSES, campaignConfigSchema } from "@jobpilot/contracts/campaign";
import { DAY_MS } from "@/common/date/buckets";
import type { PilotQuestion, PrismaClient } from "@/generated/prisma/client";
import { PROMOTABLE_SOURCES, publishCampaignStatus } from "@/modules/campaign/campaign.utils";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { recoverApplyingJobs } from "@/modules/campaign/jobs/recover-applying";
import type { PilotJournalService } from "../journal.service";
import { SERVER_SKIP_REASONS } from "../skip-reasons";
import { GATHER_CAP, parseJobRef, parseJobSubject } from "./run-history";

/** An `applying` job with no open run and no update for this long lost its driver. */
const STALE_APPLYING_MS = 30 * 60 * 1000;
/** A week-long pause would otherwise wake to dead postings ranked above everything else. */
const APPROVED_JOB_STALE_MS = 7 * DAY_MS;
/** Recent job activity means someone may be mid-session on the campaign. */
const FINALIZE_IDLE_MS = 10 * 60 * 1000;
const MAX_OPEN_APPLY_RUNS = 20;

/**
 * Expires runs and questions, and returns what they held to a workable state. An interrupted apply
 * is parked for the user rather than retried, since it may already have been submitted; returns
 * the recovery questions for the caller to publish once this transaction commits.
 */
export async function runExpiry(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<PilotQuestion[]> {
  return prisma.$transaction(async (tx) => {
    const recoveryQuestions: PilotQuestion[] = [];
    const expiredRuns = await tx.pilotRun.findMany({
      where: { userId, finishedAt: null, expiresAt: { lt: now } },
      take: GATHER_CAP,
      select: { id: true, taskType: true, payload: true },
    });
    if (expiredRuns.length > 0) {
      await tx.pilotRun.updateMany({
        where: { id: { in: expiredRuns.map((run) => run.id) }, finishedAt: null },
        data: { finishedAt: now, outcome: "expired" },
      });
      const jobs = expiredRuns
        .filter((run) => run.taskType === "job.apply")
        .map((run) => parseJobRef(run.payload));
      if (jobs.length > 0) {
        const parked = await recoverApplyingJobs(tx, userId, {
          status: "applying",
          campaign: { userId },
          OR: jobs,
        });
        recoveryQuestions.push(...parked);
      }
    }

    // A crashed terminal apply takes no run, so its job would stay `applying` and block finalize.
    const openApplyRuns = await tx.pilotRun.findMany({
      where: { userId, taskType: "job.apply", finishedAt: null, expiresAt: { gte: now } },
      take: MAX_OPEN_APPLY_RUNS,
      select: { payload: true },
    });
    const stale = await recoverApplyingJobs(tx, userId, {
      status: "applying",
      campaign: { userId },
      updatedAt: { lt: new Date(now.getTime() - STALE_APPLYING_MS) },
      NOT: openApplyRuns.map((run) => parseJobRef(run.payload)),
    });
    recoveryQuestions.push(...stale);

    // Pilot campaigns only: a user's own queue is theirs to clear.
    await tx.job.updateMany({
      where: {
        status: "approved",
        campaign: { userId, createdBy: "pilot" },
        createdAt: { lt: new Date(now.getTime() - APPROVED_JOB_STALE_MS) },
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.wentStale },
    });

    const expiredQuestions = await tx.pilotQuestion.findMany({
      where: { userId, status: "open", expiresAt: { not: null, lt: now } },
      take: GATHER_CAP,
      select: { id: true, subjectType: true, subjectId: true },
    });
    if (expiredQuestions.length === 0) return recoveryQuestions;

    await tx.pilotQuestion.updateMany({
      where: { id: { in: expiredQuestions.map((question) => question.id) }, status: "open" },
      data: { status: "expired" },
    });
    const parkedJobs = expiredQuestions.flatMap((question) =>
      question.subjectType === "job" && question.subjectId
        ? [parseJobSubject(question.subjectId)]
        : [],
    );
    if (parkedJobs.length === 0) return recoveryQuestions;

    await tx.job.updateMany({
      where: {
        status: "needs_user",
        campaign: { userId },
        OR: parkedJobs,
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.unanswered },
    });
    return recoveryQuestions;
  });
}

/** Settles scored pending jobs now instead of waiting for the next discovery run. */
export async function promoteScoredPendingJobs(
  prisma: PrismaClient,
  campaignJobs: CampaignJobService,
  userId: string,
  fallbackMinScore: number,
): Promise<void> {
  const rows = await prisma.job.findMany({
    where: {
      status: "pending",
      matchScore: { not: null },
      campaign: { userId, status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
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

/** Server-side because a bare status flip needs no agent, and as a task it starved forever. */
export async function finalizeIdleCampaigns(
  prisma: PrismaClient,
  journal: PilotJournalService,
  userId: string,
  now: Date,
): Promise<void> {
  const idle = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
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
    select: { campaignId: true, query: true, source: true },
  });

  const results = await Promise.all(
    idle.map((campaign) =>
      // Guarded on status, so a concurrent transition wins over the sweep.
      prisma.campaign.updateMany({
        where: { campaignId: campaign.campaignId, userId, status: "in_progress" },
        data: {
          status: "completed",
          statusActor: "pilot",
          statusReason: "No active work remaining.",
          completedAt: now,
        },
      }),
    ),
  );
  const completed = idle.filter((_, index) => results[index].count > 0);
  if (completed.length === 0) return;

  for (const campaign of completed) publishCampaignStatus(userId, campaign, "completed");
  await journal.appendJournal(userId, {
    entries: completed.map((campaign) => ({
      kind: "action" as const,
      subjectType: "campaign",
      subjectId: campaign.campaignId,
      summary: `Completed campaign '${campaign.query}' - no active work remaining.`,
    })),
  });
}
