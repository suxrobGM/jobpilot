import { nextDailyRun, type PilotJobAlerts, pilotConfigSchema } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { toInputJson } from "@/common/json";
import { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { pendingJobAlertsWhere } from "./tasks/gather-inbox";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

@injectable()
export class JobAlertsService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly pilot = inject(PilotService),
  ) {}

  private async loadConfig(userId: string) {
    const row = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { config: true },
    });
    return pilotConfigSchema.parse(row?.config ?? {});
  }

  async getStatus(userId: string) {
    const now = new Date();
    const [config, lastRun, account] = await Promise.all([
      this.loadConfig(userId),
      this.prisma.pilotRun.findFirst({
        where: { userId, taskType: "inbox.jobAlerts" },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          finishedAt: true,
          outcome: true,
          subjectType: true,
          subjectId: true,
        },
      }),
      this.prisma.emailAccount.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    const settings = config.jobAlerts;

    const [pendingEmails, feed] = await Promise.all([
      this.prisma.emailMessage.count({ where: pendingJobAlertsWhere(userId, settings, now) }),
      // The run's result names the feed it opened.
      lastRun?.subjectType === "feed"
        ? this.prisma.feed.findFirst({
            where: { id: lastRun.subjectId, userId },
            select: { id: true, name: true },
          })
        : null,
    ]);

    return {
      settings,
      mailboxConnected: account !== null,
      pendingEmails,
      nextRunAt: settings.enabled ? nextDailyRun(settings.runHours, settings.timeZone, now) : null,
      lastRun: lastRun
        ? {
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            outcome: lastRun.outcome,
            feed,
          }
        : null,
    };
  }

  /** Edits only the import block, so it never races an edit to the rest of the config. */
  async updateSettings(userId: string, settings: PilotJobAlerts) {
    const config = toInputJson({ ...(await this.loadConfig(userId)), jobAlerts: settings });
    await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, config },
      update: { config, ...TASK_LIST_SNAPSHOT_RESET },
    });
    await this.wakePilot(userId);
    return this.getStatus(userId);
  }

  /** The terminal host ends its idle sleep on `state.changed`, so the run starts in seconds. */
  private wakePilot(userId: string) {
    return this.pilot.publishCurrentState(userId);
  }
}
