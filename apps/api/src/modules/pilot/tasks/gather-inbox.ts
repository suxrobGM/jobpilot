import { campaignConfigSchema } from "@jobpilot/contracts/campaign";
import {
  JOB_ALERT_EXCLUDED_MAILBOXES,
  jobAlertSenderDomains,
  latestDailyRun,
  type PilotInstructionsConfig,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP, latestRun, ranRecently, withoutConsumingRuns } from "./run-history";

const INBOX_BATCH = 10;
const UPWORK_SYNC_STALE_MS = 6 * HOUR_MS;
const JOB_ALERTS_BATCH = 40;
/** Older alerts point at filled postings; shorter lost mail from a few days of app downtime. */
const JOB_ALERTS_LOOKBACK_MS = 7 * DAY_MS;
/** A Run now the pilot never got to lapses rather than firing hours later. */
const RUN_NOW_EXPIRES_AFTER_MS = HOUR_MS;

type JobAlertsSettings = PilotInstructionsConfig["jobAlerts"];
type LatestRun = Awaited<ReturnType<typeof latestRun>>;

/** Answered questions no open or finished run has consumed yet. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"question.answered">[]> {
  const answered = await prisma.pilotQuestion.findMany({
    where: { userId, status: "answered" },
    orderBy: { answeredAt: "desc" },
    take: GATHER_CAP,
    select: {
      id: true,
      kind: true,
      prompt: true,
      subjectType: true,
      subjectId: true,
      answer: true,
    },
  });
  const open = await withoutConsumingRuns(
    prisma,
    userId,
    "question.answered",
    answered,
    (question) => question.id,
  );
  return open.map(({ id, kind, ...question }) => ({
    ...question,
    questionId: id,
    questionKind: kind,
  }));
}

/** The oldest unclassified mail, plus how much is waiting in total. */
export async function gatherInbox(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"inbox.review">> {
  const where = { account: { userId }, classification: null, reviewStatus: "pending" } as const;
  const [rows, count] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: INBOX_BATCH,
      select: { id: true },
    }),
    prisma.emailMessage.count({ where }),
  ]);
  return { messageIds: rows.map((row) => row.id), count };
}

/**
 * Interviewing applications whose latest interview email has no reply question yet. An open
 * question is a draft in flight; an answered one was already approved.
 */
export async function gatherInterviewReplies(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"interview.reply">[]> {
  const apps = await prisma.application.findMany({
    where: { userId, status: "interviewing" },
    select: {
      id: true,
      company: true,
      title: true,
      emailMessages: {
        where: { classification: "interviewing" },
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: { id: true, threadId: true, fromAddress: true, subject: true, receivedAt: true },
      },
    },
  });
  const replies = apps.flatMap(({ emailMessages: [email], ...app }) =>
    email
      ? [
          {
            applicationId: app.id,
            emailMessageId: email.id,
            threadId: email.threadId,
            from: email.fromAddress,
            subject: email.subject,
            receivedAt: email.receivedAt,
            company: app.company,
            jobTitle: app.title,
          },
        ]
      : [],
  );
  if (replies.length === 0) return [];

  const questions = await prisma.pilotQuestion.findMany({
    where: {
      userId,
      subjectType: "email",
      subjectId: { in: replies.map((reply) => reply.emailMessageId) },
      status: { in: ["open", "answered"] },
    },
    select: { subjectId: true },
  });
  const handled = new Set(questions.map((question) => question.subjectId));
  return replies.filter((reply) => !handled.has(reply.emailMessageId));
}

/** Interviewing applications without a prep sheet yet. */
export async function gatherInterviewPreps(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"interview.prep">[]> {
  const apps = await prisma.application.findMany({
    where: {
      userId,
      status: "interviewing",
      events: { none: { kind: "interview_prep" } },
    },
    select: {
      id: true,
      company: true,
      title: true,
      url: true,
      campaign: { select: { config: true } },
    },
  });
  return apps.map((app) => ({
    applicationId: app.id,
    company: app.company,
    jobTitle: app.title,
    jobUrl: app.url,
    resumeId: app.campaign
      ? (campaignConfigSchema.parse(app.campaign.config).resumeId ?? null)
      : null,
  }));
}

/**
 * A stale Upwork mirror, or none yet. Only for users with Upwork rows: nothing here can tell whether
 * the MCP is connected, so the run damper is what stops "not connected" repeating every cycle.
 */
export async function gatherUpworkSync(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"upwork.syncInbox"> | null> {
  const [account, profileCount] = await Promise.all([
    prisma.upworkAccount.findUnique({ where: { userId }, select: { lastSyncedAt: true } }),
    prisma.upworkProfile.count({ where: { userId } }),
  ]);
  if (!account && profileCount === 0) return null;

  const lastSyncedAt = account?.lastSyncedAt ?? null;
  const fresh = lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < UPWORK_SYNC_STALE_MS;
  if (fresh) return null;
  const lastRun = await latestRun(prisma, userId, "upwork.syncInbox");
  if (ranRecently(lastRun, now, UPWORK_SYNC_STALE_MS)) return null;

  const unreadCount = await prisma.upworkInboxItem.count({ where: { userId, status: "unread" } });
  return { lastSyncedAt, unreadCount };
}

export function hasPendingRunNow(requestedAt: Date | null, lastRun: LatestRun, now: Date): boolean {
  if (requestedAt === null) return false;
  if (now.getTime() - requestedAt.getTime() >= RUN_NOW_EXPIRES_AFTER_MS) return false;
  return !lastRun || lastRun.startedAt < requestedAt;
}

/** Run now fires regardless of schedule; otherwise one successful run per scheduled time, failures retry hourly. */
export function jobAlertsDue(
  settings: JobAlertsSettings,
  lastRun: LatestRun,
  requestedAt: Date | null,
  now: Date,
): boolean {
  if (lastRun && !lastRun.finishedAt) return false;
  if (hasPendingRunNow(requestedAt, lastRun, now)) return true;
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

export async function gatherJobAlerts(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  requestedAt: Date | null,
  now: Date,
): Promise<TaskPayload<"inbox.jobAlerts"> | null> {
  const settings = config.jobAlerts;
  if (!settings.enabled && requestedAt === null) return null;

  const lastRun = await latestRun(prisma, userId, "inbox.jobAlerts");
  if (!jobAlertsDue(settings, lastRun, requestedAt, now)) return null;

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
