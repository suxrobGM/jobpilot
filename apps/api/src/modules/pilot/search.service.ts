import type {
  CreatePilotSearchInput,
  ReportPilotSearchRunInput,
  UpdatePilotSearchInput,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { HOUR_MS } from "@/common/date/buckets";
import { conflict, findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { BOARD_REF_SELECT, JobBoardService } from "@/modules/job-board/job-board.service";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

/** A run with this many new jobs is "good": re-run it soon while the board is yielding. */
const GOOD_RUN_NEW_JOBS = 3;
const RERUN_GOOD_SEARCH_MS = 2 * HOUR_MS;
/** A thin run, or a good one that reached the board's end. */
const RERUN_SLOW_SEARCH_MS = 8 * HOUR_MS;
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
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly boards = inject(JobBoardService),
  ) {}

  private clearTaskList(userId: string) {
    return this.prisma.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
  }

  /**
   * A DB unique would treat two NULL boards as distinct, and a COALESCE index reads as schema drift
   * to Prisma. The pilot is the only writer, so losing a race costs a duplicate, not corruption.
   */
  private async assertUnique(
    userId: string,
    query: string,
    boardId: string | null,
    exceptId: string | null = null,
  ) {
    const clash = await this.prisma.pilotSearch.findFirst({
      where: { userId, query, boardId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw conflict("A search with this query and board already exists.");
  }

  private findOwnedSearch(userId: string, id: string) {
    return findOwned(
      (where) =>
        this.prisma.pilotSearch.findFirst({
          where,
          select: { query: true, boardId: true, emptyRuns: true },
        }),
      { id, userId },
      "Search",
    );
  }

  list(userId: string) {
    return this.prisma.pilotSearch.findMany({
      where: { userId },
      include: SEARCH_INCLUDE,
      orderBy: { nextRunAt: "asc" },
    });
  }

  async create(userId: string, input: CreatePilotSearchInput) {
    const boardId = await this.boards.resolveId(input.board ?? null);
    await this.assertUnique(userId, input.query, boardId);
    const row = await this.prisma.pilotSearch.create({
      data: {
        userId,
        query: input.query,
        boardId,
        resumeId: input.resumeId ?? null,
        reason: input.reason,
      },
      include: SEARCH_INCLUDE,
    });
    await this.clearTaskList(userId);
    return row;
  }

  async update(userId: string, id: string, input: UpdatePilotSearchInput) {
    const existing = await this.findOwnedSearch(userId, id);
    const query = input.query ?? existing.query;
    const boardId =
      input.board === undefined ? existing.boardId : await this.boards.resolveId(input.board);
    // A different query or board is a different search, so its schedule starts over.
    const isNewSearch = query !== existing.query || boardId !== existing.boardId;
    if (isNewSearch) await this.assertUnique(userId, query, boardId, id);

    const row = await this.prisma.pilotSearch.update({
      where: { id },
      include: SEARCH_INCLUDE,
      data: {
        query: input.query,
        ...(input.board !== undefined && { boardId }),
        resumeId: input.resumeId,
        reason: input.reason,
        ...(isNewSearch
          ? { emptyRuns: 0, nextRunAt: new Date(), lastJobsScanned: null, lastNewJobs: null }
          : {}),
      },
    });
    await this.clearTaskList(userId);
    return row;
  }

  async remove(userId: string, id: string) {
    await this.findOwnedSearch(userId, id);
    await this.prisma.pilotSearch.delete({ where: { id } });
    await this.clearTaskList(userId);
    return { deleted: id };
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
