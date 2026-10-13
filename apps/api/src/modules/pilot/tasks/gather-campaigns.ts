import { campaignConfigSchema } from "@jobpilot/contracts/campaign";
import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { summarizeCampaigns } from "@/modules/campaign/campaign.summary";
import { GATHER_CAP, latestRunBySubject, ranRecently, withoutRecentRuns } from "./run-history";

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

/** Pending rows a worker must open: never scored, or scored off a results row it never read. */
export const NEEDS_WORKER_VISIT = {
  status: "pending",
  OR: [{ matchScore: null }, { brief: null }, { description: null }],
} satisfies Prisma.JobWhereInput;

const QUEUED = { status: "queued" } satisfies Prisma.JobWhereInput;

/** Auto-apply campaigns holding rows that still need a score or a brief. */
export async function gatherScorePending(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<TaskPayload<"campaign.scorePending">[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      source: "auto_apply",
      jobs: { some: NEEDS_WORKER_VISIT },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      query: true,
      config: true,
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
    userId,
    "campaign.scorePending",
    now,
    BATCH_COOLDOWN_MS,
    campaigns,
    (campaign) => campaign.campaignId,
  );
  return startable.map((campaign) => {
    const config = campaignConfigSchema.parse(campaign.config);
    return {
      campaignId: campaign.campaignId,
      query: campaign.query,
      board: config.board ?? null,
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
      campaignId: true,
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
    userId,
    "queue.score",
    now,
    BATCH_COOLDOWN_MS,
    campaigns,
    (campaign) => campaign.campaignId,
  );
  return startable.map((campaign) => {
    const config = campaignConfigSchema.parse(campaign.config);
    return {
      campaignId: campaign.campaignId,
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
    where: { userId, status: "paused", source: "auto_apply" },
    orderBy: { updatedAt: "asc" },
    take: PAUSED_CANDIDATES,
    select: { campaignId: true, query: true, config: true, updatedAt: true },
  });
  if (campaigns.length === 0) return [];

  const ids = campaigns.map((campaign) => campaign.campaignId);
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
      const decided = (questionsByCampaign.get(campaign.campaignId) ?? []).some(
        (q) => q.status === "open" || (q.answeredAt != null && q.answeredAt > campaign.updatedAt),
      );
      const damped = ranRecently(latest.get(campaign.campaignId), now, PAUSED_REVIEW_RETRY_MS);
      return !decided && !damped;
    })
    .map((campaign) => ({
      campaignId: campaign.campaignId,
      query: campaign.query,
      board: campaignConfigSchema.parse(campaign.config).board ?? null,
      pausedAt: campaign.updatedAt,
    }));
}

const reviewMarkerSchema = z.object({ type: z.string().optional() }).loose();

/** Tunes, rescans and retries; the agent's action journaled with `detail.type` holds each back a week. */
export async function gatherCampaignReviews(prisma: PrismaClient, userId: string, now: Date) {
  const [campaigns, markers] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId, status: "in_progress", source: { not: "networking" } },
      select: { campaignId: true, query: true, config: true, source: true },
    }),
    prisma.pilotJournalEntry.findMany({
      where: {
        userId,
        kind: "action",
        subjectType: "campaign",
        createdAt: { gte: new Date(now.getTime() - REVIEW_REPEAT_MS) },
      },
      select: { subjectId: true, detail: true },
    }),
  ]);
  const marked = new Set(
    markers.map((marker) => `${reviewMarkerSchema.parse(marker.detail).type}:${marker.subjectId}`),
  );
  const isFresh = (type: string, campaignId: string) => !marked.has(`${type}:${campaignId}`);

  const campaignTunes: TaskPayload<"campaign.tune">[] = [];
  const rescanSkipped: TaskPayload<"job.rescanSkipped">[] = [];
  const retryFailed: TaskPayload<"job.retryFailed">[] = [];

  const summaries = await summarizeCampaigns(prisma, campaigns);
  for (const { campaignId, query, config, summary } of summaries) {
    if (summary.kind !== "jobs") continue;
    const converting = summary.qualified / summary.totalFound >= TUNE_MAX_QUALIFIED_RATIO;
    if (summary.totalFound >= TUNE_MIN_JOBS && !converting && isFresh("tune", campaignId)) {
      const { minScore, board } = campaignConfigSchema.parse(config);
      campaignTunes.push({
        campaignId,
        query,
        config: { minScore: minScore ?? null, board: board ?? null },
        counts: {
          totalFound: summary.totalFound,
          qualified: summary.qualified,
          applied: summary.applied,
          skipped: summary.skipped,
        },
        topSkipReasons: [],
      });
    }
    if (summary.skipped >= RESCAN_MIN_SKIPPED && isFresh("rescanSkipped", campaignId)) {
      rescanSkipped.push({ campaignId, skippedCount: summary.skipped });
    }
    if (summary.failed >= RETRY_MIN_FAILED && isFresh("retryFailed", campaignId)) {
      retryFailed.push({ campaignId, failedCount: summary.failed });
    }
  }

  if (campaignTunes.length > 0) {
    const reasons = await prisma.job.groupBy({
      by: ["campaignId", "skipReason"],
      where: {
        campaignId: { in: campaignTunes.map((tune) => tune.campaignId) },
        status: "skipped",
        skipReason: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { skipReason: "desc" } },
    });
    const reasonsByCampaign = Map.groupBy(reasons, (row) => row.campaignId);
    for (const tune of campaignTunes) {
      tune.topSkipReasons = (reasonsByCampaign.get(tune.campaignId) ?? [])
        .flatMap((row) => (row.skipReason ? [row.skipReason] : []))
        .slice(0, TOP_SKIP_REASONS);
    }
  }
  return { campaignTunes, rescanSkipped, retryFailed };
}
