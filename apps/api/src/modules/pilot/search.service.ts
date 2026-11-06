import type { ReportPilotSearchRunInput } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { HOUR_MS } from "@/common/date/buckets";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { BOARD_REF_SELECT } from "@/modules/job-board/job-board.service";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

/** A run with this many new jobs is "good": re-run it soon while the board is yielding. */
const GOOD_RUN_NEW_JOBS = 3;
const RERUN_GOOD_SEARCH_MS = 2 * HOUR_MS;
/** A thin run, or a good one that reached the board's end. */
const RERUN_SLOW_SEARCH_MS = 8 * HOUR_MS;
const WEEK_MS = 7 * 24 * HOUR_MS;
/** Consecutive empty runs climb this ladder and hold on its last rung. */
const EMPTY_RUN_BACKOFF_MS = [8 * HOUR_MS, 24 * HOUR_MS, 48 * HOUR_MS];

/** The next-run schedule after one discovery run. `emptyRuns` is the streak before this run. */
export function scheduleNextRun(emptyRuns: number, run: ReportPilotSearchRunInput, now: Date) {
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

const SEARCH_INCLUDE = { board: { select: BOARD_REF_SELECT } } satisfies Prisma.PilotSearchInclude;

/** The pilot's self-managed discovery searches. */
@injectable()
export class PilotSearchService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  private clearTaskList(userId: string) {
    return this.prisma.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
  }

  private findOwnedSearch(userId: string, id: string) {
    return findOwned(
      (where) =>
        this.prisma.pilotSearch.findFirst({
          where,
          select: { emptyRuns: true },
        }),
      { id, userId },
      "Search",
    );
  }

  async list(userId: string, now = new Date()) {
    const [searches, applied, paused] = await Promise.all([
      this.prisma.pilotSearch.findMany({
        where: { userId },
        include: SEARCH_INCLUDE,
        orderBy: { nextRunAt: "asc" },
      }),
      this.prisma.application.findMany({
        where: {
          userId,
          appliedAt: { gte: new Date(now.getTime() - WEEK_MS) },
          campaign: { pilotSearchId: { not: null } },
        },
        select: { campaign: { select: { pilotSearchId: true } } },
      }),
      // A search is paused through its standing campaign, which discovery skips.
      this.prisma.campaign.findMany({
        where: { userId, status: "paused", pilotSearchId: { not: null } },
        select: { pilotSearchId: true },
      }),
    ]);
    const pausedIds = new Set(paused.map((campaign) => campaign.pilotSearchId));
    const counts = new Map<string, number>();
    for (const { campaign } of applied) {
      const searchId = campaign?.pilotSearchId;
      if (searchId) counts.set(searchId, (counts.get(searchId) ?? 0) + 1);
    }
    return searches.map((search) => ({
      ...search,
      appliedThisWeek: counts.get(search.id) ?? 0,
      paused: pausedIds.has(search.id),
    }));
  }

  async reportRun(userId: string, id: string, input: ReportPilotSearchRunInput) {
    const existing = await this.findOwnedSearch(userId, id);
    const row = await this.prisma.pilotSearch.update({
      where: { id },
      include: SEARCH_INCLUDE,
      data: scheduleNextRun(existing.emptyRuns, input, new Date()),
    });
    await this.clearTaskList(userId);
    return row;
  }
}
