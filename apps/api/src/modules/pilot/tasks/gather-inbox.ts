import { campaignConfigSchema } from "@jobpilot/contracts/campaign";
import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { CRASH_OUTCOMES, GATHER_CAP, latestRun, ranRecently } from "./run-history";

const INBOX_BATCH = 10;
const UPWORK_SYNC_STALE_MS = 6 * HOUR_MS;
/** Marks an ApplicationEvent note as a generated interview prep sheet. */
const INTERVIEW_PREP_MARKER = "[interview-prep]";

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
      writeForMe: true,
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
