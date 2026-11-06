import { feedConfigSchema } from "@jobpilot/contracts/feed";
import type { TaskPayload, TaskType } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { JobStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
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

const QUEUED = { status: "queued" } satisfies Prisma.JobWhereInput;
/** Jobs that cleared the min score, whatever happened to them after. */
const QUALIFIED: JobStatus[] = ["approved", "applying", "applied", "needs_user", "failed"];

/** Auto-apply feeds holding rows that still need a score or a brief. */
export async function gatherScorePending(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<TaskPayload<"feed.score">[]> {
  const feeds = await prisma.feed.findMany({
    where: scorePendingWhere(userId),
    take: GATHER_CAP,
    select: {
      id: true,
      name: true,
      query: true,
      resumeId: true,
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
    { userId, taskType: "feed.score", now, cooldownMs: BATCH_COOLDOWN_MS },
    feeds,
    (feed) => feed.id,
  );
  return startable.map((feed) => {
    const config = feedConfigSchema.parse(feed.config);
    return {
      feedId: feed.id,
      query: feed.query ?? feed.name,
      board: feed.board?.domain ?? null,
      resumeId: feed.resumeId ?? undefined,
      minScore: config.minScore ?? fallbackMinScore,
      pendingCount: feed._count.jobs,
      entries: feed.jobs,
    };
  });
}

/** Feeds holding pasted links nothing has visited yet. */
export async function gatherQueueScores(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<TaskPayload<"queue.score">[]> {
  const feeds = await prisma.feed.findMany({
    where: { userId, pausedAt: null, archivedAt: null, jobs: { some: QUEUED } },
    take: GATHER_CAP,
    select: {
      id: true,
      resumeId: true,
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
    feeds,
    (feed) => feed.id,
  );
  return startable.map((feed) => {
    const config = feedConfigSchema.parse(feed.config);
    return {
      feedId: feed.id,
      resumeId: feed.resumeId ?? undefined,
      minScore: config.minScore ?? fallbackMinScore,
      queuedCount: feed._count.jobs,
      entries: feed.jobs,
    };
  });
}

/** Searches the pilot or agent paused, longest paused first, that nobody has decided on yet. */
export async function gatherPausedFeeds(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"search.review">[]> {
  const feeds = await prisma.feed.findMany({
    where: reviewPausedWhere(userId),
    orderBy: { pausedAt: "asc" },
    take: PAUSED_CANDIDATES,
    select: { id: true, query: true, pausedAt: true, board: { select: { domain: true } } },
  });
  if (feeds.length === 0) return [];

  const ids = feeds.map((feed) => feed.id);
  const [questions, latest] = await Promise.all([
    prisma.pilotQuestion.findMany({
      where: {
        userId,
        subjectType: "feed",
        subjectId: { in: ids },
        status: { in: ["open", "answered"] },
      },
      take: PAUSED_CANDIDATES,
      select: { subjectId: true, status: true, answeredAt: true },
    }),
    latestRunBySubject(prisma, userId, "search.review", ids),
  ]);
  const questionsByFeed = Map.groupBy(questions, (question) => question.subjectId);

  return feeds
    .filter((feed) => {
      // An answer older than the pause belongs to an earlier pause episode.
      const pausedAt = feed.pausedAt ?? now;
      const decided = (questionsByFeed.get(feed.id) ?? []).some(
        (q) => q.status === "open" || (q.answeredAt != null && q.answeredAt > pausedAt),
      );
      const damped = ranRecently(latest.get(feed.id), now, PAUSED_REVIEW_RETRY_MS);
      return !decided && !damped;
    })
    .map((feed) => ({
      feedId: feed.id,
      query: feed.query ?? "",
      board: feed.board?.domain ?? null,
      pausedAt: feed.pausedAt ?? now,
    }));
}

/** Tunes for searches, rescans and retries for any job feed; each holds its feed back a week. */
export async function gatherFeedReviews(prisma: PrismaClient, userId: string, now: Date) {
  const feeds = await prisma.feed.findMany({
    where: { userId, pausedAt: null, archivedAt: null, kind: { notIn: ["networking", "upwork"] } },
    select: {
      id: true,
      kind: true,
      query: true,
      config: true,
      board: { select: { domain: true } },
    },
  });
  const counts = await prisma.job.groupBy({
    by: ["feedId", "status"],
    where: { userId, feedId: { in: feeds.map((feed) => feed.id) } },
    _count: { _all: true },
  });
  const countsByFeed = Map.groupBy(counts, (row) => row.feedId);

  const feedTunes: TaskPayload<"search.tune">[] = [];
  const rescanSkipped: TaskPayload<"job.rescanSkipped">[] = [];
  const retryFailed: TaskPayload<"job.retryFailed">[] = [];

  for (const feed of feeds) {
    const rows = countsByFeed.get(feed.id) ?? [];
    const count = (statuses: JobStatus[]) =>
      rows
        .filter((row) => statuses.includes(row.status))
        .reduce((n, row) => n + row._count._all, 0);
    const totalFound = rows.reduce((n, row) => n + row._count._all, 0);
    const qualified = count(QUALIFIED);
    const skipped = count(["skipped"]);
    const failed = count(["failed"]);
    const converting = qualified / totalFound >= TUNE_MAX_QUALIFIED_RATIO;
    if (feed.kind === "search" && totalFound >= TUNE_MIN_JOBS && !converting) {
      const { minScore } = feedConfigSchema.parse(feed.config);
      feedTunes.push({
        feedId: feed.id,
        query: feed.query ?? "",
        config: { minScore: minScore ?? null, board: feed.board?.domain ?? null },
        counts: { totalFound, qualified, applied: count(["applied"]), skipped },
        topSkipReasons: [],
      });
    }
    if (skipped >= RESCAN_MIN_SKIPPED) {
      rescanSkipped.push({ feedId: feed.id, skippedCount: skipped });
    }
    if (failed >= RETRY_MIN_FAILED) {
      retryFailed.push({ feedId: feed.id, failedCount: failed });
    }
  }

  const filter = (taskType: TaskType) => ({ userId, taskType, now, cooldownMs: REVIEW_REPEAT_MS });
  const byFeed = (row: Pick<TaskPayload<"search.tune">, "feedId">) => row.feedId;
  const [tunes, rescans, retries] = await Promise.all([
    withoutRecentRuns(prisma, filter("search.tune"), feedTunes, byFeed),
    withoutRecentRuns(prisma, filter("job.rescanSkipped"), rescanSkipped, byFeed),
    withoutRecentRuns(prisma, filter("job.retryFailed"), retryFailed, byFeed),
  ]);

  if (tunes.length > 0) {
    const reasons = await prisma.job.groupBy({
      by: ["feedId", "skipReason"],
      where: {
        feedId: { in: tunes.map((tune) => tune.feedId) },
        status: "skipped",
        skipReason: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { skipReason: "desc" } },
    });
    const reasonsByFeed = Map.groupBy(reasons, (row) => row.feedId);
    for (const tune of tunes) {
      tune.topSkipReasons = (reasonsByFeed.get(tune.feedId) ?? [])
        .flatMap((row) => (row.skipReason ? [row.skipReason] : []))
        .slice(0, TOP_SKIP_REASONS);
    }
  }
  return { feedTunes: tunes, rescanSkipped: rescans, retryFailed: retries };
}
