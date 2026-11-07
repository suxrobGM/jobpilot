import {
  type PilotConfig,
  pilotConfigSchema,
  type TaskList,
  taskListSchema,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { toInputJson } from "@/common/json";
import { PrismaClient } from "@/generated/prisma/client";
import { EmailSyncService } from "@/modules/email/sync/sync.service";
import { buildTaskList } from "./build";
import { DigestService } from "./digest.service";
import { gatherAutonomousWork, NO_AUTONOMOUS_WORK } from "./gather/autonomous";
import { gatherCounts } from "./gather/counts";
import { gatherChat, gatherRequests } from "./gather/requests";
import { PilotMaintenanceService } from "./maintenance.service";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
/** The default check interval: idle cycles always pull mail, busy 15s cycles don't. */
export const INBOX_SYNC_STALE_MS = 30 * 60 * 1000;

@injectable()
export class TaskListService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly maintenance = inject(PilotMaintenanceService),
    private readonly digest = inject(DigestService),
    private readonly emailSync = inject(EmailSyncService),
  ) {}

  /** The current snapshot, with none of refresh's writes. */
  async getCurrent(userId: string) {
    const state = await this.prisma.pilotState.findUnique({ where: { userId } });
    const expiresAt = state?.taskListExpiresAt;
    const snapshot = state?.taskListSnapshot;
    const live = snapshot && expiresAt && expiresAt > new Date();
    return { taskList: live ? taskListSchema.parse(snapshot) : null };
  }

  /** Runs whether or not autopilot is on: requests, chat and answered questions always run. */
  async refresh(userId: string): Promise<TaskList> {
    const state = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { autopilot: true, cycleCount: true, config: true, goals: true },
    });
    const { autopilot, cycleCount } = state;
    const now = new Date();
    const config = pilotConfigSchema.parse(state.config);
    const goals = state.goals.trim();

    await this.maintain(userId, config, autopilot, now);
    const ctx = { prisma: this.prisma, userId, now };
    const countsRead = gatherCounts(ctx);
    const [{ searchCount, ...counts }, work, requests, chat] = await Promise.all([
      countsRead,
      autopilot
        ? gatherAutonomousWork(ctx, { config, goals, counts: countsRead })
        : NO_AUTONOMOUS_WORK,
      gatherRequests(ctx, { config, goals, cycleCount }),
      gatherChat(ctx),
    ]);
    void this.digest.writeIfDue(userId, now, counts.openQuestions);

    const content = buildTaskList({
      ...counts,
      ...work,
      now,
      config,
      autopilot,
      cycleCount,
      requests,
      chat,
      awaitingSetup: searchCount === 0 || goals === "",
    });
    const taskList: TaskList = {
      ...content,
      version: crypto.randomUUID(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    };
    await this.prisma.pilotState.update({
      where: { userId },
      data: {
        taskListVersion: taskList.version,
        taskListExpiresAt: taskList.expiresAt,
        taskListSnapshot: toInputJson(taskList),
      },
    });
    return taskList;
  }

  /** Mail first so inbox.review sees it; settling before the gather so fresh approvals keep a feed open. */
  private async maintain(userId: string, config: PilotConfig, autopilot: boolean, now: Date) {
    await this.emailSync.syncIfStale(userId, INBOX_SYNC_STALE_MS, now);
    await this.maintenance.expireStaleWork(userId, now);
    if (autopilot) {
      await this.maintenance.settleScoredJobs(userId, config.minScore);
    }
  }
}
