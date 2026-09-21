import {
  JOB_ALERT_EXCLUDED_MAILBOXES,
  jobAlertSenderDomains,
  latestDailyRun,
  nextDailyRun,
  type PilotInstructionsConfig,
} from "@jobpilot/contracts/pilot";
import type { PilotClaimOutcome, Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  JOB_ALERTS_BATCH,
  JOB_ALERTS_LOOKBACK_MS,
  JOB_ALERTS_REQUEST_TTL_MS,
  JOB_ALERTS_RETRY_MS,
} from "./constants";
import type { AgendaJobAlerts } from "./types";

const JOB_ALERTS_KIND = "inbox.jobAlerts";

type JobAlertsSettings = PilotInstructionsConfig["jobAlerts"];

export interface LastHarvestClaim {
  grantedAt: Date;
  releasedAt: Date | null;
  expiresAt: Date;
  outcome: PilotClaimOutcome | null;
}

/**
 * Whether a harvest is due. A live "Run now" request fires regardless of the schedule; otherwise one
 * successful run per scheduled slot, and a failed or crashed run retries after JOB_ALERTS_RETRY_MS
 * rather than waiting half a day for the next slot.
 */
export function jobAlertsDue(
  settings: JobAlertsSettings,
  lastClaim: LastHarvestClaim | null,
  requestedAt: Date | null,
  now: Date,
): boolean {
  if (lastClaim && lastClaim.releasedAt === null && lastClaim.expiresAt > now) return false;

  const liveRequest =
    requestedAt !== null &&
    now.getTime() - requestedAt.getTime() < JOB_ALERTS_REQUEST_TTL_MS &&
    (!lastClaim || lastClaim.grantedAt < requestedAt);
  if (liveRequest) return true;

  if (!settings.enabled) return false;
  const slot = latestDailyRun(settings.runHours, settings.timeZone, now);
  if (!slot) return false;
  if (!lastClaim) return true;
  if (lastClaim.outcome === "done") return lastClaim.grantedAt < slot;
  return now.getTime() - lastClaim.grantedAt.getTime() >= JOB_ALERTS_RETRY_MS;
}

/** Sender-domain match that also takes subdomains (`e.theladders.com`). */
function senderDomainFilter(domains: string[]) {
  return domains.flatMap((domain) => [
    { fromDomain: domain },
    { fromDomain: { endsWith: `.${domain}` } },
  ]);
}

/** Unharvested alert mail a run would read now; shared by the agenda and the schedule card. */
export function pendingJobAlertsWhere(
  userId: string,
  settings: JobAlertsSettings,
  now: Date,
): Prisma.EmailMessageWhereInput {
  return {
    account: { userId },
    harvestedAt: null,
    receivedAt: { gte: new Date(now.getTime() - JOB_ALERTS_LOOKBACK_MS) },
    OR: senderDomainFilter(jobAlertSenderDomains(settings)),
    NOT: JOB_ALERT_EXCLUDED_MAILBOXES.map((mailbox) => ({
      fromAddress: { startsWith: `${mailbox}@` },
    })),
    // Spelled out: `NOT {classification: "verification"}` is NULL in SQL for unclassified mail,
    // which silently drops every message inbox.review has not reached yet.
    AND: [{ OR: [{ classification: null }, { classification: { not: "verification" } }] }],
  };
}

export function findLastHarvestClaim(
  prisma: PrismaClient,
  userId: string,
): Promise<LastHarvestClaim | null> {
  return prisma.pilotClaim.findFirst({
    where: { userId, kind: JOB_ALERTS_KIND },
    orderBy: { grantedAt: "desc" },
    select: { grantedAt: true, releasedAt: true, expiresAt: true, outcome: true },
  });
}

export async function gatherJobAlerts(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  requestedAt: Date | null,
  now: Date,
): Promise<{ alerts: AgendaJobAlerts | null; nextRunAt: Date | null }> {
  const settings = config.jobAlerts;
  const nextRunAt = settings.enabled
    ? nextDailyRun(settings.runHours, settings.timeZone, now)
    : null;
  if (!settings.enabled && requestedAt === null) return { alerts: null, nextRunAt };

  const lastClaim = await findLastHarvestClaim(prisma, userId);
  if (!jobAlertsDue(settings, lastClaim, requestedAt, now)) return { alerts: null, nextRunAt };

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
  if (count === 0) return { alerts: null, nextRunAt };
  return {
    alerts: {
      messageIds: rows.map((row) => row.id),
      count,
      senderDomains: jobAlertSenderDomains(settings),
    },
    nextRunAt,
  };
}
