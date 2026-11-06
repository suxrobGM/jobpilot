import {
  JOB_ALERT_EXCLUDED_MAILBOXES,
  jobAlertSenderDomains,
  latestDailyRun,
  type PilotConfig,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { latestRun, ranRecently } from "../../runs/run-history";
import { isFeedPaused } from "./feed-paused";

const JOB_ALERTS_BATCH = 40;
/** Older alerts point at filled postings; shorter lost mail from a few days of app downtime. */
const JOB_ALERTS_LOOKBACK_MS = 7 * DAY_MS;

type JobAlertsSettings = PilotConfig["jobAlerts"];
type LatestRun = Awaited<ReturnType<typeof latestRun>>;

/** One successful run per scheduled time; failures retry hourly. */
export function jobAlertsDue(settings: JobAlertsSettings, lastRun: LatestRun, now: Date): boolean {
  if (lastRun && !lastRun.finishedAt) return false;
  if (!settings.enabled) return false;
  const lastScheduledRun = latestDailyRun(settings.runHours, settings.timeZone, now);
  if (!lastScheduledRun) return false;
  if (!lastRun) return true;
  if (lastRun.outcome === "done") return lastRun.startedAt < lastScheduledRun;
  return !ranRecently(lastRun, now, HOUR_MS);
}

export function pendingJobAlertsWhere(
  userId: string,
  settings: JobAlertsSettings,
  now: Date,
): Prisma.EmailMessageWhereInput {
  return {
    account: { userId },
    importedAt: null,
    receivedAt: { gte: new Date(now.getTime() - JOB_ALERTS_LOOKBACK_MS) },
    // Subdomains too: alerts come from hosts like `e.theladders.com`.
    OR: jobAlertSenderDomains(settings).flatMap((domain) => [
      { fromDomain: domain },
      { fromDomain: { endsWith: `.${domain}` } },
    ]),
    NOT: JOB_ALERT_EXCLUDED_MAILBOXES.map((mailbox) => ({
      fromAddress: { startsWith: `${mailbox}@` },
    })),
    // `NOT { classification: "verification" }` is NULL in SQL for unclassified mail and drops it.
    AND: [{ OR: [{ classification: null }, { classification: { not: "verification" } }] }],
  };
}

/** The scheduled import, when it's due and its feed isn't paused. */
export async function gatherJobAlerts(
  prisma: PrismaClient,
  userId: string,
  config: PilotConfig,
  now: Date,
): Promise<TaskPayload<"inbox.jobAlerts"> | null> {
  if (!config.jobAlerts.enabled) return null;
  const lastRun = await latestRun(prisma, userId, "inbox.jobAlerts");
  if (!jobAlertsDue(config.jobAlerts, lastRun, now)) return null;
  if (await isFeedPaused(prisma, userId, "job_alerts")) return null;
  return findJobAlerts(prisma, userId, config, now);
}

/** The unimported alert emails, or null when there are none. */
export async function findJobAlerts(
  prisma: PrismaClient,
  userId: string,
  config: PilotConfig,
  now: Date,
): Promise<TaskPayload<"inbox.jobAlerts"> | null> {
  const settings = config.jobAlerts;
  const where = pendingJobAlertsWhere(userId, settings, now);
  const [rows, count] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: JOB_ALERTS_BATCH,
      select: { id: true },
    }),
    prisma.emailMessage.count({ where }),
  ]);
  if (count === 0) return null;
  return {
    messageIds: rows.map((row) => row.id),
    count,
    minScore: config.minScore,
    senderDomains: jobAlertSenderDomains(settings),
  };
}
