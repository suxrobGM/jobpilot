import type {
  CreatePilotSearchInput,
  ReportPilotSearchRunInput,
  UpdatePilotSearchInput,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import {
  EMPTY_RUN_BACKOFF_MS,
  GOOD_RUN_NEW_JOBS,
  RERUN_GOOD_SEARCH_MS,
  RERUN_SLOW_SEARCH_MS,
} from "./agenda/constants";
import { AGENDA_SNAPSHOT_RESET } from "./agenda/snapshot";

export interface ScheduleRunInput {
  /** Consecutive empty runs recorded *before* this run. */
  emptyRuns: number;
  jobsSeen: number;
  newJobs: number;
  reachedEnd: boolean;
  now: Date;
}

export interface ScheduleRunResult {
  emptyRuns: number;
  nextRunAt: Date;
  lastRunAt: Date;
  lastJobsSeen: number;
  lastNewJobs: number;
}

/**
 * Pure next-run policy for one discovery run: a good, still-yielding search re-runs soon; a dry
 * one backs off up the 8h/24h/48h ladder. No user cadence knob.
 */
export function scheduleNextRun(input: ScheduleRunInput): ScheduleRunResult {
  const { emptyRuns, jobsSeen, newJobs, reachedEnd, now } = input;
  const at = (ms: number) => new Date(now.getTime() + ms);
  const base = { lastRunAt: now, lastJobsSeen: jobsSeen, lastNewJobs: newJobs };

  if (newJobs === 0) {
    // Step up the backoff ladder, holding at its last rung.
    const next = emptyRuns + 1;
    const rung = EMPTY_RUN_BACKOFF_MS[Math.min(next - 1, EMPTY_RUN_BACKOFF_MS.length - 1)];
    return { ...base, emptyRuns: next, nextRunAt: at(rung) };
  }

  const stillYielding = newJobs >= GOOD_RUN_NEW_JOBS && !reachedEnd;
  return {
    ...base,
    emptyRuns: 0,
    nextRunAt: at(stillYielding ? RERUN_GOOD_SEARCH_MS : RERUN_SLOW_SEARCH_MS),
  };
}

/** Owns the pilot's self-managed searches: CRUD plus applying a run's result to its schedule. */
@singleton()
export class PilotSearchService {
  constructor(private readonly prisma: PrismaClient) {}

  /** A search mutation invalidates the cached agenda, same as an instructions edit. */
  private nullAgenda(userId: string) {
    return this.prisma.pilotState.updateMany({ where: { userId }, data: AGENDA_SNAPSHOT_RESET });
  }

  /**
   * A plain DB unique on (userId, query, board) would treat two NULL boards as distinct, and an
   * expression index on COALESCE(board, '') is not expressible in schema.prisma - it would read as
   * permanent drift. So the check lives here; the pilot is the only writer, so a losing race is a
   * duplicate search, not corruption.
   */
  private async assertUnique(
    userId: string,
    query: string,
    board: string | null,
    excludeId?: string,
  ) {
    const clash = await this.prisma.pilotSearch.findFirst({
      where: { userId, query, board, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) throw conflict("A search with this query and board already exists.");
  }

  list(userId: string) {
    return this.prisma.pilotSearch.findMany({ where: { userId }, orderBy: { nextRunAt: "asc" } });
  }

  async create(userId: string, input: CreatePilotSearchInput) {
    const board = input.board ?? null;
    await this.assertUnique(userId, input.query, board);
    const row = await this.prisma.pilotSearch.create({
      data: {
        userId,
        query: input.query,
        board,
        resumeId: input.resumeId ?? null,
        reason: input.reason,
      },
    });
    await this.nullAgenda(userId);
    return row;
  }

  async update(userId: string, id: string, input: UpdatePilotSearchInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotSearch.findFirst({ where }),
      { id, userId },
      "Search",
    );

    const nextQuery = input.query ?? existing.query;
    const nextBoard = input.board !== undefined ? input.board : existing.board;
    const scheduleReset = nextQuery !== existing.query || nextBoard !== existing.board;
    if (scheduleReset) await this.assertUnique(userId, nextQuery, nextBoard, id);

    const row = await this.prisma.pilotSearch.update({
      where: { id },
      // An undefined field is Prisma's "leave unchanged", which is exactly the patch semantics.
      data: {
        query: input.query,
        board: input.board,
        resumeId: input.resumeId,
        reason: input.reason,
        // A different query/board is a different search: restart its scheduling from now.
        ...(scheduleReset
          ? { emptyRuns: 0, nextRunAt: new Date(), lastJobsSeen: null, lastNewJobs: null }
          : {}),
      },
    });
    await this.nullAgenda(userId);
    return row;
  }

  async remove(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.pilotSearch.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Search",
    );
    await this.prisma.pilotSearch.delete({ where: { id } });
    await this.nullAgenda(userId);
    return { deleted: id };
  }

  async reportRun(userId: string, id: string, input: ReportPilotSearchRunInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotSearch.findFirst({ where, select: { emptyRuns: true } }),
      { id, userId },
      "Search",
    );
    const schedule = scheduleNextRun({ emptyRuns: existing.emptyRuns, now: new Date(), ...input });
    const row = await this.prisma.pilotSearch.update({ where: { id }, data: schedule });
    await this.nullAgenda(userId);
    return row;
  }
}
