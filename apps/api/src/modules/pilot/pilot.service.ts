import {
  type PilotState,
  pilotInstructionsConfigSchema,
  type RecordIdleCycleInput,
  type UpdatePilotSettingsInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import { type PilotState as PilotStateModel, PrismaClient } from "@/generated/prisma/client";
import { recordCycle } from "./journal-entries";
import { costByTaskType, countAppliedToday, countSentToday } from "./pilot.stats";
import { allowedToday } from "./tasks/allowed-today";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";
import { taskTitle } from "./tasks/task-defs";

/** Pilot state, instructions, and the stats and liveness reads. */
@injectable()
export class PilotService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  private async toState(row: PilotStateModel): Promise<PilotState> {
    const config = pilotInstructionsConfigSchema.parse(row.instructionsConfig);
    const now = new Date();
    const [appliedToday, networkingSentToday, openRun] = await Promise.all([
      countAppliedToday(this.prisma, row.userId, now),
      countSentToday(this.prisma, row.userId, now),
      this.prisma.pilotRun.findFirst({
        where: { userId: row.userId, finishedAt: null, expiresAt: { gt: now } },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          taskType: true,
          subjectType: true,
          subjectId: true,
          payload: true,
          startedAt: true,
        },
      }),
    ]);
    const currentRun = openRun && {
      id: openRun.id,
      taskType: openRun.taskType,
      title: taskTitle(openRun),
      startedAt: openRun.startedAt,
    };
    return {
      userId: row.userId,
      autopilot: row.autopilot,
      instructionsGoals: row.instructionsGoals,
      instructionsConfig: config,
      instructionsUpdatedAt: row.instructionsUpdatedAt,
      lastCycleAt: row.lastCycleAt,
      nextWakeAt: row.nextWakeAt,
      cycleCount: row.cycleCount,
      appliedToday,
      networkingSentToday,
      capReached: allowedToday(config, { appliedToday, networkingSentToday }).appliesLeft === 0,
      currentRun,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Every state write publishes, so the web and the terminal see the same row. */
  private async publishState(row: PilotStateModel) {
    const state = await this.toState(row);
    publish(pilotChannel, { userId: row.userId }, { type: "state.changed", state });
    return state;
  }

  private async readGoals(userId: string): Promise<string> {
    const row = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsGoals: true },
    });
    return row?.instructionsGoals ?? "";
  }

  /** Every profile has exactly one state row, created with defaults on first read. */
  async getState(userId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toState(row);
  }

  /** Settings outside goals and rules; the pilot reads them live, so nothing else moves. */
  async updateSettings(userId: string, body: UpdatePilotSettingsInput) {
    const saved = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsConfig: true },
    });
    const config = pilotInstructionsConfigSchema.parse(saved?.instructionsConfig ?? {});
    const instructions = {
      instructionsConfig: toInputJson({ ...config, ...body }),
      instructionsUpdatedAt: new Date(),
      ...TASK_LIST_SNAPSHOT_RESET,
    };
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, ...instructions },
      update: instructions,
    });
    return this.publishState(row);
  }

  /** Autopilot gates only autonomous work; it needs goals to have anything to work toward. */
  async setAutopilot(userId: string, on: boolean) {
    if (on && (await this.readGoals(userId)).trim() === "") {
      throw conflict("Write the pilot's goals before turning on autopilot.");
    }
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, autopilot: on },
      update: { autopilot: on, ...TASK_LIST_SNAPSHOT_RESET },
    });
    return this.publishState(row);
  }

  /** Clears run history only; instructions, searches and autopilot survive. */
  async reset(userId: string) {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.pilotJournalEntry.deleteMany({ where: { userId } });
      return tx.pilotState.upsert({
        where: { userId },
        create: { userId },
        update: {
          cycleCount: 0,
          lastCycleAt: null,
          nextWakeAt: null,
          ...TASK_LIST_SNAPSHOT_RESET,
        },
      });
    });
    return this.publishState(row);
  }

  /** Counts as a cycle like a journaled one, so board rotation still advances while idle. */
  async recordIdleCycle(userId: string, body: RecordIdleCycleInput) {
    const row = await recordCycle(this.prisma, userId, 1, body.sleepSeconds, new Date());
    return this.publishState(row);
  }

  /** For writes made elsewhere, such as a journaled cycle. */
  async publishCurrentState(userId: string) {
    const row = await this.prisma.pilotState.findUnique({ where: { userId } });
    if (row) {
      await this.publishState(row);
    }
  }

  async getCost(userId: string) {
    return { items: await costByTaskType(this.prisma, userId, new Date()) };
  }

  /** Newest server-side activity, so the terminal can tell a slow live cycle from a stuck one. */
  async getActivity(userId: string) {
    const { prisma } = this;
    const [runs, journal, campaign, job, state] = await Promise.all([
      prisma.pilotRun.findMany({
        where: { userId, finishedAt: null },
        select: { startedAt: true, heartbeatAt: true, expiresAt: true },
      }),
      prisma.pilotJournalEntry.aggregate({ where: { userId }, _max: { createdAt: true } }),
      prisma.campaign.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      prisma.campaignJob.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      prisma.pilotState.findUnique({
        where: { userId },
        select: { lastCycleAt: true, nextWakeAt: true },
      }),
    ]);

    const times = [
      ...runs.flatMap((run) => [run.startedAt, run.heartbeatAt]),
      journal._max.createdAt,
      campaign._max.updatedAt,
      job._max.updatedAt,
    ].filter((time) => time != null);
    const now = new Date();
    const lastCycleAt = state?.lastCycleAt ?? null;
    const nextWakeAt = state?.nextWakeAt ?? null;

    return {
      lastActivityAt: times.reduce<Date | null>(
        (max, time) => (!max || time > max ? time : max),
        null,
      ),
      // An expired run nobody has swept yet still counts as activity, but not as active.
      activeRuns: runs.filter((run) => run.expiresAt > now).length,
      // A stuck-recovery cycle plans no wake, and the host still needs its completedAt.
      lastCycle: lastCycleAt && {
        completedAt: lastCycleAt,
        sleepSeconds: nextWakeAt
          ? Math.round((nextWakeAt.getTime() - lastCycleAt.getTime()) / 1000)
          : null,
      },
    };
  }
}
