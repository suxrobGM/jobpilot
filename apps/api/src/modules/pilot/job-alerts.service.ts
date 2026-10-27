import {
  nextDailyRun,
  type PilotJobAlerts,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { toInputJson } from "@/common/json";
import { normalizeJobUrl } from "@/common/utils/url";
import { PrismaClient } from "@/generated/prisma/client";
import { EmailSyncService } from "@/modules/email/sync/sync.service";
import { PilotService } from "./pilot.service";
import { hasPendingRunNow, pendingJobAlertsWhere } from "./tasks/gather-inbox";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

/** A run-now click syncs first so the count is current, but never re-pulls a mailbox just synced. */
const RUN_NOW_SYNC_STALE_MS = 2 * 60 * 1000;

/** Alert emails repeat a posting for days; a week back covers the repeats. */
const SEEN_WINDOW_MS = 7 * DAY_MS;

@injectable()
export class JobAlertsService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly emailSync = inject(EmailSyncService),
    private readonly pilot = inject(PilotService),
  ) {}

  private async loadState(userId: string) {
    const row = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsConfig: true, running: true, jobAlertsRequestedAt: true },
    });
    return {
      config: pilotInstructionsConfigSchema.parse(row?.instructionsConfig ?? {}),
      running: row?.running ?? false,
      requestedAt: row?.jobAlertsRequestedAt ?? null,
    };
  }

  async getStatus(userId: string) {
    const now = new Date();
    const [state, lastRun, account] = await Promise.all([
      this.loadState(userId),
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
    const settings = state.config.jobAlerts;

    const [pendingEmails, campaign] = await Promise.all([
      this.prisma.emailMessage.count({ where: pendingJobAlertsWhere(userId, settings, now) }),
      // The run's result names the campaign it opened.
      lastRun?.subjectType === "campaign"
        ? this.prisma.campaign.findFirst({
            where: { id: lastRun.subjectId, userId },
            select: { id: true, query: true },
          })
        : null,
    ]);

    const { requestedAt } = state;
    return {
      settings,
      pilotRunning: state.running,
      mailboxConnected: account !== null,
      pendingEmails,
      nextRunAt: settings.enabled ? nextDailyRun(settings.runHours, settings.timeZone, now) : null,
      requestedAt: hasPendingRunNow(requestedAt, lastRun, now) ? requestedAt : null,
      lastRun: lastRun
        ? {
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            outcome: lastRun.outcome,
            campaign,
          }
        : null,
    };
  }

  /** Edits only the import block, so it never races the instructions editor's other fields. */
  async updateSettings(userId: string, settings: PilotJobAlerts) {
    const { config } = await this.loadState(userId);
    const instructionsConfig = toInputJson({ ...config, jobAlerts: settings });
    await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, instructionsConfig },
      update: {
        instructionsConfig,
        instructionsUpdatedAt: new Date(),
        ...TASK_LIST_SNAPSHOT_RESET,
      },
    });
    await this.wakePilot(userId);
    return this.getStatus(userId);
  }

  async runNow(userId: string) {
    const now = new Date();
    await this.emailSync.syncIfStale(userId, RUN_NOW_SYNC_STALE_MS, now);
    const { config } = await this.loadState(userId);
    const pendingEmails = await this.prisma.emailMessage.count({
      where: pendingJobAlertsWhere(userId, config.jobAlerts, now),
    });

    // Nothing to read: a queued request would sit until mail arrived and then fire unasked.
    if (pendingEmails === 0) {
      return { queued: false, pendingEmails };
    }

    await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, jobAlertsRequestedAt: now },
      update: { jobAlertsRequestedAt: now, ...TASK_LIST_SNAPSHOT_RESET },
    });
    await this.wakePilot(userId);
    return { queued: true, pendingEmails };
  }

  /** The given URLs already in one of the user's campaigns from the last week, compared normalized. */
  async seenUrls(userId: string, urls: string[]) {
    const normalized = urls.map(normalizeJobUrl);
    const rows = await this.prisma.job.findMany({
      where: {
        url: { in: [...new Set(normalized)] },
        createdAt: { gte: new Date(Date.now() - SEEN_WINDOW_MS) },
        campaign: { userId },
      },
      distinct: ["url"],
      select: { url: true },
    });
    const found = new Set(rows.map((row) => row.url));
    return { seen: urls.filter((_, i) => found.has(normalized[i])) };
  }

  /** The terminal host ends its idle sleep on `state.changed`, so the run starts in seconds. */
  private wakePilot(userId: string) {
    return this.pilot.publishCurrentState(userId);
  }
}
