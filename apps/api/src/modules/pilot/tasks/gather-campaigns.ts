import { campaignConfigSchema } from "@jobpilot/contracts/campaign";
import type { TaskPayload, TaskType } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { summarizeCampaigns } from "@/modules/campaign/campaign.summary";
import { GATHER_CAP, latestRunBySubject, ranRecently, withoutRecentRuns } from "./run-history";
import { NEEDS_WORKER_VISIT, reviewPausedWhere, scorePendingWhere } from "./workable";

const BATCH_SIZE = 5;
/** A row nothing can visit (dead URL, login wall) stays a candidate, so it must not win every cycle. */
const BATCH_COOLDOWN_MS = HOUR_MS;
const PAUSED_CANDIDATES = 20;
/** Damps resume/re-pause loops. */
const PAUSED_REVIEW_RETRY_MS = DAY_MS;
const TUNE_MIN_JOBS = 20;
const TUNE_MAX_QUALIFIED_RATIO = 0.2;
const RESCAN_MIN_SKIPPED = 5;
const RETRY_MIN_FAILED = 3;
const TOP_SKIP_REASONS = 3;
const REVIEW_REPEAT_MS = 7 * DAY_MS;

const QUEUED = { status: "queued" } satisfies Prisma.CampaignJobWhereInput;

/** Auto-apply campaigns holding rows that still need a score or a brief. */
export async function gatherScorePending(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<TaskPayload<"campaign.scorePending">[]> {
  const campaigns = await prisma.campaign.findMany({
    where: scorePendingWhere(userId),
    take: GATHER_CAP,
    select: {
      id: true,
      query: true,
      config: true,
      board: { select: { domain: true } },
      _count: { select: { jobs: { where: NEEDS_WORKER_VISIT } } },
      jobs: {
        where: NEEDS_WORKER_VISIT,
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        select: { key: true, url: true, title: true },
      },
    },
  });
  const startable = await withoutRecentRuns(
    prisma,
    { userId, taskType: "campaign.scorePending", now, cooldownMs: BATCH_COOLDOWN_MS },
    campaigns,
    (campaign) => campaign.id,
  );
  return startable.map((campaign) => {
    const config = campaignConfigSchema.parse(campaign.config);
    return {
      campaignId: campaign.id,
      query: campaign.query,
      board: campaign.board?.domain ?? null,
      resumeId: config.resumeId,
      minScore: config.minScore ?? fallbackMinScore,
      pendingCount: campaign._count.jobs,
      entries: campaign.jobs,
    };
  });
}

/** Apply campaigns holding pasted links nothing has visited yet. */
export async function gatherQueueScores(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<TaskPayload<"queue.score">[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: "in_progress", source: "apply", jobs: { some: QUEUED } },
    take: GATHER_CAP,
    select: {
      id: true,
      config: true,
      _count: { select: { jobs: { where: QUEUED } } },
      jobs: {
        where: QUEUED,
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        select: { key: true, url: true },
      },
    },
  });
  const startable = await withoutRecentRuns(
    prisma,
    { userId, taskType: "queue.score", now, cooldownMs: BATCH_COOLDOWN_MS },
    campaigns,
    (campaign) => campaign.id,
  );
  return startable.map((campaign) => {
    const config = campaignConfigSchema.parse(campaign.config);
    return {
      campaignId: campaign.id,
      resumeId: config.resumeId,
      minScore: config.minScore ?? fallbackMinScore,
      queuedCount: campaign._count.jobs,
      entries: campaign.jobs,
    };
  });
}

/** Paused auto-apply campaigns, longest paused first, that nobody has decided on yet. */
export async function gatherPausedCampaigns(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"campaign.reviewPaused">[]> {
  const campaigns = await prisma.campaign.findMany({
    where: reviewPausedWhere(userId),
    orderBy: { updatedAt: "asc" },
    take: PAUSED_CANDIDATES,
    select: { id: true, query: true, updatedAt: true, board: { select: { domain: true } } },
  });
  if (campaigns.length === 0) return [];

  const ids = campaigns.map((campaign) => campaign.id);
  const [questions, latest] = await Promise.all([
    prisma.pilotQuestion.findMany({
      where: {
        userId,
        subjectType: "campaign",
        subjectId: { in: ids },
        status: { in: ["open", "answered"] },
      },
      take: PAUSED_CANDIDATES,
      select: { subjectId: true, status: true, answeredAt: true },
    }),
    latestRunBySubject(prisma, userId, "campaign.reviewPaused", ids),
  ]);
  const questionsByCampaign = Map.groupBy(questions, (question) => question.subjectId);

  return campaigns
    .filter((campaign) => {
      // An answer older than the pause belongs to an earlier pause episode.
      const decided = (questionsByCampaign.get(campaign.id) ?? []).some(
        (q) => q.status === "open" || (q.answeredAt != null && q.answeredAt > campaign.updatedAt),
      );
      const damped = ranRecently(latest.get(campaign.id), now, PAUSED_REVIEW_RETRY_MS);
      return !decided && !damped;
    })
    .map((campaign) => ({
      campaignId: campaign.id,
      query: campaign.query,
      board: campaign.board?.domain ?? null,
      pausedAt: campaign.updatedAt,
    }));
}

/** Tunes, rescans and retries; a run of one holds the same campaign back a week. */
export async function gatherCampaignReviews(prisma: PrismaClient, userId: string, now: Date) {
  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: "in_progress", source: { not: "networking" } },
    select: {
      id: true,
      query: true,
      config: true,
      source: true,
      board: { select: { domain: true } },
    },
  });

  const campaignTunes: TaskPayload<"campaign.tune">[] = [];
  const rescanSkipped: TaskPayload<"job.rescanSkipped">[] = [];
  const retryFailed: TaskPayload<"job.retryFailed">[] = [];

  const summaries = await summarizeCampaigns(prisma, campaigns);
  for (const { id: campaignId, query, config, board, summary } of summaries) {
    if (summary.kind !== "jobs") continue;
    const converting = summary.qualified / summary.totalFound >= TUNE_MAX_QUALIFIED_RATIO;
    if (summary.totalFound >= TUNE_MIN_JOBS && !converting) {
      const { minScore } = campaignConfigSchema.parse(config);
      campaignTunes.push({
        campaignId,
        query,
        config: { minScore: minScore ?? null, board: board?.domain ?? null },
        counts: {
          totalFound: summary.totalFound,
          qualified: summary.qualified,
          applied: summary.applied,
          skipped: summary.skipped,
        },
        topSkipReasons: [],
      });
    }
    if (summary.skipped >= RESCAN_MIN_SKIPPED) {
      rescanSkipped.push({ campaignId, skippedCount: summary.skipped });
    }
    if (summary.failed >= RETRY_MIN_FAILED) {
      retryFailed.push({ campaignId, failedCount: summary.failed });
    }
  }

  const filter = (taskType: TaskType) => ({ userId, taskType, now, cooldownMs: REVIEW_REPEAT_MS });
  const byCampaign = (row: Pick<TaskPayload<"campaign.tune">, "campaignId">) => row.campaignId;
  const [tunes, rescans, retries] = await Promise.all([
    withoutRecentRuns(prisma, filter("campaign.tune"), campaignTunes, byCampaign),
    withoutRecentRuns(prisma, filter("job.rescanSkipped"), rescanSkipped, byCampaign),
    withoutRecentRuns(prisma, filter("job.retryFailed"), retryFailed, byCampaign),
  ]);

  if (tunes.length > 0) {
    const reasons = await prisma.campaignJob.groupBy({
      by: ["campaignId", "skipReason"],
      where: {
        campaignId: { in: tunes.map((tune) => tune.campaignId) },
        status: "skipped",
        skipReason: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { skipReason: "desc" } },
    });
    const reasonsByCampaign = Map.groupBy(reasons, (row) => row.campaignId);
    for (const tune of tunes) {
      tune.topSkipReasons = (reasonsByCampaign.get(tune.campaignId) ?? [])
        .flatMap((row) => (row.skipReason ? [row.skipReason] : []))
        .slice(0, TOP_SKIP_REASONS);
    }
  }
  return { campaignTunes: tunes, rescanSkipped: rescans, retryFailed: retries };
}
