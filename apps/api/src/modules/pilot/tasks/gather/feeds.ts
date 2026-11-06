import { feedConfigSchema } from "@jobpilot/contracts/feed";
import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  GATHER_CAP,
  latestRunBySubject,
  ranRecently,
  withoutRecentRuns,
} from "../../runs/run-history";
import { NEEDS_WORKER_VISIT, reviewPausedWhere, scorePendingWhere } from "./workable";

const BATCH_SIZE = 5;
/** A row nothing can visit (dead URL, login wall) stays a candidate, so it must not win every cycle. */
const BATCH_COOLDOWN_MS = HOUR_MS;
const PAUSED_CANDIDATES = 20;
/** Damps resume/re-pause loops. */
const PAUSED_REVIEW_RETRY_MS = DAY_MS;

const QUEUED = { status: "queued" } satisfies Prisma.JobWhereInput;

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
