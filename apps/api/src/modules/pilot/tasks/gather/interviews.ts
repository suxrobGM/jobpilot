import type { TaskPayload } from "@jobpilot/contracts/pilot";
import type { GatherContext } from "./gather-context";

/**
 * Interviewing applications whose latest interview email has no reply question yet. An open
 * question is a draft in flight; an answered one was already approved.
 */
export async function gatherInterviewReplies(
  ctx: GatherContext,
): Promise<TaskPayload<"interview.reply">[]> {
  const { prisma, userId } = ctx;
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
  if (replies.length === 0) {
    return [];
  }

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
  ctx: GatherContext,
): Promise<TaskPayload<"interview.prep">[]> {
  const { prisma, userId } = ctx;
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
      feed: { select: { resumeId: true } },
    },
  });
  return apps.map((app) => ({
    applicationId: app.id,
    company: app.company,
    jobTitle: app.title,
    jobUrl: app.url,
    resumeId: app.feed?.resumeId ?? null,
  }));
}
