import {
  type CreateFeedInput,
  type FeedKind,
  feedConfigSchema,
  type ReportSearchRunInput,
  type UpdateFeedInput,
} from "@jobpilot/contracts/feed";
import { inject, injectable } from "@needle-di/core";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import { findOwned, isPrismaError, PRISMA_ERRORS } from "@/common/errors";
import { type Actor, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { BOARD_REF_SELECT } from "@/modules/job-board/job-board.service";
import { dropTaskList } from "@/modules/pilot/tasks/snapshot";
import { publishFeedUpdated } from "./feed-events";

/** A run with this many new jobs is "good": re-run it soon while the board is yielding. */
const GOOD_RUN_NEW_JOBS = 3;
const RERUN_GOOD_SEARCH_MS = 2 * HOUR_MS;
/** A thin run, or a good one that reached the board's end. */
const RERUN_SLOW_SEARCH_MS = 8 * HOUR_MS;
/** Consecutive empty runs climb this ladder and hold on its last rung. */
const EMPTY_RUN_BACKOFF_MS = [8 * HOUR_MS, 24 * HOUR_MS, 48 * HOUR_MS];
const WEEK_MS = 7 * DAY_MS;

type SingleKind = CreateFeedInput["kind"];

const SINGLE_FEEDS: Record<SingleKind, { name: string; createdBy: Actor }> = {
  job_alerts: { name: "Job alerts", createdBy: "pilot" },
  research: { name: "Research", createdBy: "pilot" },
  links: { name: "Links you added", createdBy: "user" },
  manual: { name: "Started in terminal", createdBy: "user" },
  upwork: { name: "Upwork", createdBy: "user" },
  networking: { name: "Networking", createdBy: "user" },
};

const FEED_INCLUDE = { board: { select: BOARD_REF_SELECT } } satisfies Prisma.FeedInclude;

type FeedRow = Prisma.FeedGetPayload<{ include: typeof FEED_INCLUDE }>;

function toFeed(row: FeedRow) {
  return { ...row, config: feedConfigSchema.parse(row.config) };
}

/** The next-run schedule after one discovery run. `emptyRuns` is the streak before this run. */
export function scheduleNextRun(emptyRuns: number, run: ReportSearchRunInput, now: Date) {
  const at = (ms: number) => new Date(now.getTime() + ms);
  const recorded = { lastRunAt: now, lastJobsScanned: run.jobsScanned, lastNewJobs: run.newJobs };

  if (run.newJobs === 0) {
    const rung = EMPTY_RUN_BACKOFF_MS[Math.min(emptyRuns, EMPTY_RUN_BACKOFF_MS.length - 1)];
    return { ...recorded, emptyRuns: emptyRuns + 1, nextRunAt: at(rung) };
  }
  const stillYielding = run.newJobs >= GOOD_RUN_NEW_JOBS && !run.reachedEnd;
  return {
    ...recorded,
    emptyRuns: 0,
    nextRunAt: at(stillYielding ? RERUN_GOOD_SEARCH_MS : RERUN_SLOW_SEARCH_MS),
  };
}

/** Where jobs come from: the pilot's searches and the user's one feed of each other kind. */
@injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async list(userId: string, kind: FeedKind | undefined, now = new Date()) {
    const [feeds, applied] = await Promise.all([
      this.prisma.feed.findMany({
        where: { userId, kind, archivedAt: null },
        include: FEED_INCLUDE,
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      }),
      this.prisma.application.groupBy({
        by: ["feedId"],
        where: { userId, appliedAt: { gte: new Date(now.getTime() - WEEK_MS) } },
        _count: { _all: true },
      }),
    ]);
    const appliedByFeed = new Map(applied.map((row) => [row.feedId, row._count._all]));
    return feeds.map((feed) => ({
      ...toFeed(feed),
      appliedThisWeek: appliedByFeed.get(feed.id) ?? 0,
    }));
  }

  /** Get-or-create: a concurrent create loses to the one-per-kind unique index and reads the winner. */
  async ensure(userId: string, kind: SingleKind) {
    const existing = await this.prisma.feed.findFirst({
      where: { userId, kind },
      include: FEED_INCLUDE,
    });
    if (existing) return toFeed(existing);
    try {
      const created = await this.prisma.feed.create({
        data: { userId, kind, ...SINGLE_FEEDS[kind] },
        include: FEED_INCLUDE,
      });
      return toFeed(created);
    } catch (error) {
      if (!isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) throw error;
      return toFeed(
        await this.prisma.feed.findFirstOrThrow({ where: { userId, kind }, include: FEED_INCLUDE }),
      );
    }
  }

  async get(userId: string, id: string) {
    return toFeed(await this.findFeed(userId, id));
  }

  /** Paused feeds drop out of the pilot's gathering; the agent pauses one whose board blocks it. */
  async setPaused(userId: string, id: string, body: UpdateFeedInput) {
    await this.findFeed(userId, id);
    const pause = body.paused
      ? { pausedAt: new Date(), pausedBy: body.actor, pausedReason: body.reason ?? null }
      : { pausedAt: null, pausedBy: null, pausedReason: null };
    const [row] = await this.prisma.$transaction([
      this.prisma.feed.update({ where: { id }, data: pause, include: FEED_INCLUDE }),
      dropTaskList(this.prisma, userId),
    ]);
    publishFeedUpdated(userId, id);
    return toFeed(row);
  }

  async reportRun(userId: string, id: string, input: ReportSearchRunInput) {
    const existing = await this.findFeed(userId, id);
    const [row] = await this.prisma.$transaction([
      this.prisma.feed.update({
        where: { id },
        include: FEED_INCLUDE,
        data: scheduleNextRun(existing.emptyRuns, input, new Date()),
      }),
      dropTaskList(this.prisma, userId),
    ]);
    return toFeed(row);
  }

  private findFeed(userId: string, id: string) {
    return findOwned(
      (where) => this.prisma.feed.findFirst({ where, include: FEED_INCLUDE }),
      { id, userId },
      "Feed",
    );
  }
}
