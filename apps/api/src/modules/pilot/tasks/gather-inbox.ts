import { campaignConfigSchema } from "@jobpilot/contracts/campaign";
import {
  JOB_ALERT_EXCLUDED_MAILBOXES,
  jobAlertSenderDomains,
  latestDailyRun,
  nextDailyRun,
  type PilotInstructionsConfig,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { PilotRun, Prisma, PrismaClient } from "@/generated/prisma/client";
import { CRASH_OUTCOMES, GATHER_CAP, latestRun, ranRecently } from "./run-history";

const INBOX_BATCH = 10;
const UPWORK_SYNC_STALE_MS = 6 * HOUR_MS;
/** Marks an ApplicationEvent note as a generated interview prep sheet. */
const INTERVIEW_PREP_MARKER = "[interview-prep]";
/** Alert emails one harvest reads; twice a day this covers any realistic alert volume. */
const JOB_ALERTS_BATCH = 40;
/** A week: older alerts point at filled postings, but three days lost mail from app downtime. */
const JOB_ALERTS_LOOKBACK_MS = 7 * DAY_MS;
/** A harvest that failed or crashed retries this soon instead of waiting for the next slot. */
const JOB_ALERTS_RETRY_MS = HOUR_MS;
/** A "Run now" the pilot never got to (stopped, or busy for an hour) lapses rather than firing later. */
const JOB_ALERTS_REQUEST_TTL_MS = HOUR_MS;

type JobAlertsSettings = PilotInstructionsConfig["jobAlerts"];

export type HarvestRun = Pick<PilotRun, "startedAt" | "finishedAt" | "expiresAt" | "outcome">;

type JobAlertsPayload = Omit<TaskPayload<"inbox.jobAlerts">, "minScore">;

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
  if (answered.length === 0) return [];

  const runs = await prisma.pilotRun.findMany({
    where: {
      userId,
      subjectType: "question",
      subjectId: { in: answered.map((question) => question.id) },
      OR: [{ finishedAt: null }, { outcome: { notIn: CRASH_OUTCOMES } }],
    },
    take: GATHER_CAP,
    select: { subjectId: true },
  });
  const consumed = new Set(runs.map((run) => run.subjectId));
  return answered
    .filter((question) => !consumed.has(question.id))
    .map(({ id, kind, ...question }) => ({ ...question, questionId: id, questionKind: kind }));
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
      events: { none: { kind: "note", note: { startsWith: INTERVIEW_PREP_MARKER } } },
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

/** A Run now request the pilot has not yet started a harvest for, and that has not lapsed. */
export function isLiveRunNowRequest(
  requestedAt: Date | null,
  lastRun: HarvestRun | null,
  now: Date,
): requestedAt is Date {
  return (
    requestedAt !== null &&
    now.getTime() - requestedAt.getTime() < JOB_ALERTS_REQUEST_TTL_MS &&
    (!lastRun || lastRun.startedAt < requestedAt)
  );
}

/**
 * A live Run now request fires regardless of the schedule; otherwise one successful run per
 * scheduled slot, and a failed or crashed run retries after JOB_ALERTS_RETRY_MS rather than waiting
 * half a day for the next slot.
 */
export function jobAlertsDue(
  settings: JobAlertsSettings,
  lastRun: HarvestRun | null,
  requestedAt: Date | null,
  now: Date,
): boolean {
  if (lastRun && lastRun.finishedAt === null && lastRun.expiresAt > now) return false;
  if (isLiveRunNowRequest(requestedAt, lastRun, now)) return true;

  if (!settings.enabled) return false;
  const slot = latestDailyRun(settings.runHours, settings.timeZone, now);
  if (!slot) return false;
  if (!lastRun) return true;
  if (lastRun.outcome === "done") return lastRun.startedAt < slot;
  return now.getTime() - lastRun.startedAt.getTime() >= JOB_ALERTS_RETRY_MS;
}

/** Unharvested alert mail a run would read now; shared by the task list and the schedule card. */
export function pendingJobAlertsWhere(
  userId: string,
  settings: JobAlertsSettings,
  now: Date,
): Prisma.EmailMessageWhereInput {
  return {
    account: { userId },
    harvestedAt: null,
    receivedAt: { gte: new Date(now.getTime() - JOB_ALERTS_LOOKBACK_MS) },
    // Subdomains too: alerts come from hosts like `e.theladders.com`.
    OR: jobAlertSenderDomains(settings).flatMap((domain) => [
      { fromDomain: domain },
      { fromDomain: { endsWith: `.${domain}` } },
    ]),
    NOT: JOB_ALERT_EXCLUDED_MAILBOXES.map((mailbox) => ({
      fromAddress: { startsWith: `${mailbox}@` },
    })),
    // Spelled out: `NOT {classification: "verification"}` is NULL in SQL for unclassified mail,
    // which silently drops every message inbox.review has not reached yet.
    AND: [{ OR: [{ classification: null }, { classification: { not: "verification" } }] }],
  };
}

export function findLastHarvestRun(
  prisma: PrismaClient,
  userId: string,
): Promise<HarvestRun | null> {
  return prisma.pilotRun.findFirst({
    where: { userId, taskType: "inbox.jobAlerts" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, finishedAt: true, expiresAt: true, outcome: true },
  });
}

/** Due harvest work, or null, plus the next scheduled slot the idle sleep wakes for. */
export async function gatherJobAlerts(
  prisma: PrismaClient,
  userId: string,
  settings: JobAlertsSettings,
  requestedAt: Date | null,
  now: Date,
): Promise<{ jobAlerts: JobAlertsPayload | null; nextJobAlertsAt: Date | null }> {
  const nextJobAlertsAt = settings.enabled
    ? nextDailyRun(settings.runHours, settings.timeZone, now)
    : null;
  const idle = { jobAlerts: null, nextJobAlertsAt };
  if (!settings.enabled && requestedAt === null) return idle;

  const lastRun = await findLastHarvestRun(prisma, userId);
  if (!jobAlertsDue(settings, lastRun, requestedAt, now)) return idle;

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
  if (count === 0) return idle;
  const jobAlerts = {
    messageIds: rows.map((row) => row.id),
    count,
    senderDomains: jobAlertSenderDomains(settings),
  };
  return { jobAlerts, nextJobAlertsAt };
}
