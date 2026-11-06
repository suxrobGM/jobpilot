import { feedConfigSchema } from "@jobpilot/contracts/feed";
import type { TaskPayload, TaskType } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";
import type { JobStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { withoutRecentRuns } from "../../runs/run-history";

const TUNE_MIN_JOBS = 20;
const TUNE_MAX_QUALIFIED_RATIO = 0.2;
const RESCAN_MIN_SKIPPED = 5;
const RETRY_MIN_FAILED = 3;
const TOP_SKIP_REASONS = 3;
const REVIEW_REPEAT_MS = 7 * DAY_MS;

/** Jobs that cleared the min score, whatever happened to them after. */
const QUALIFIED: JobStatus[] = ["approved", "applying", "applied", "needs_user", "failed"];

const REVIEW_FEED_SELECT = {
  id: true,
  kind: true,
  query: true,
  config: true,
  board: { select: { domain: true } },
} satisfies Prisma.FeedSelect;

type ReviewFeed = Prisma.FeedGetPayload<{ select: typeof REVIEW_FEED_SELECT }>;

interface StatusCount {
  feedId: string;
  status: JobStatus;
  _count: { _all: number };
}

export interface FeedReviews {
  feedTunes: TaskPayload<"search.tune">[];
  rescanSkipped: TaskPayload<"job.rescanSkipped">[];
  retryFailed: TaskPayload<"job.retryFailed">[];
}

const sumJobs = (rows: StatusCount[]) => rows.reduce((n, row) => n + row._count._all, 0);

/** The reviews each feed's job counts call for, before any cooldown. */
function reviewCandidates(feeds: ReviewFeed[], counts: StatusCount[]): FeedReviews {
  const countsByFeed = Map.groupBy(counts, (row) => row.feedId);
  const reviews: FeedReviews = { feedTunes: [], rescanSkipped: [], retryFailed: [] };

  for (const feed of feeds) {
    const rows = countsByFeed.get(feed.id) ?? [];
    const count = (statuses: JobStatus[]) =>
      sumJobs(rows.filter((row) => statuses.includes(row.status)));
    const totalFound = sumJobs(rows);
    const qualified = count(QUALIFIED);
    const skipped = count(["skipped"]);
    const failed = count(["failed"]);
    const converting = qualified / totalFound >= TUNE_MAX_QUALIFIED_RATIO;
    if (feed.kind === "search" && totalFound >= TUNE_MIN_JOBS && !converting) {
      const { minScore } = feedConfigSchema.parse(feed.config);
      reviews.feedTunes.push({
        feedId: feed.id,
        query: feed.query ?? "",
        config: { minScore: minScore ?? null, board: feed.board?.domain ?? null },
        counts: { totalFound, qualified, applied: count(["applied"]), skipped },
        topSkipReasons: [],
      });
    }
    if (skipped >= RESCAN_MIN_SKIPPED) {
      reviews.rescanSkipped.push({ feedId: feed.id, skippedCount: skipped });
    }
    if (failed >= RETRY_MIN_FAILED) {
      reviews.retryFailed.push({ feedId: feed.id, failedCount: failed });
    }
  }
  return reviews;
}

/** The tune task names why its search's jobs were skipped, most common first. */
async function attachTopSkipReasons(
  prisma: PrismaClient,
  tunes: TaskPayload<"search.tune">[],
): Promise<void> {
  if (tunes.length === 0) return;
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

/** Tunes for searches, rescans and retries for any job feed; each holds its feed back a week. */
export async function gatherFeedReviews(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<FeedReviews> {
  const feeds = await prisma.feed.findMany({
    where: { userId, pausedAt: null, archivedAt: null, kind: { notIn: ["networking", "upwork"] } },
    select: REVIEW_FEED_SELECT,
  });
  const counts = await prisma.job.groupBy({
    by: ["feedId", "status"],
    where: { userId, feedId: { in: feeds.map((feed) => feed.id) } },
    _count: { _all: true },
  });
  const candidates = reviewCandidates(feeds, counts);

  const cooldown = (taskType: TaskType) => ({
    userId,
    taskType,
    now,
    cooldownMs: REVIEW_REPEAT_MS,
  });
  const byFeed = (row: Pick<TaskPayload<"search.tune">, "feedId">) => row.feedId;
  const [feedTunes, rescanSkipped, retryFailed] = await Promise.all([
    withoutRecentRuns(prisma, cooldown("search.tune"), candidates.feedTunes, byFeed),
    withoutRecentRuns(prisma, cooldown("job.rescanSkipped"), candidates.rescanSkipped, byFeed),
    withoutRecentRuns(prisma, cooldown("job.retryFailed"), candidates.retryFailed, byFeed),
  ]);
  await attachTopSkipReasons(prisma, feedTunes);
  return { feedTunes, rescanSkipped, retryFailed };
}
