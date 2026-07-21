import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { MAX_INTERVIEW_PREPS, MAX_INTERVIEW_REPLIES, PRIORITY } from "./constants";
import type { AgendaInterviewPrep, AgendaInterviewReply } from "./types";

/** Availability-reply drafts for interview invites; subject is the email so the claim pairs with it. */
export function buildInterviewReplyItems(replies: AgendaInterviewReply[]): AgendaItem[] {
  return replies.slice(0, MAX_INTERVIEW_REPLIES).map((r) => ({
    id: `interview.reply:${r.emailMessageId}`,
    kind: "interview.reply",
    priority: PRIORITY.interviewReply,
    title: `Reply to interview invite: ${r.company}`.slice(0, 200),
    subjectType: "email",
    subjectId: r.emailMessageId,
    payload: {
      applicationId: r.applicationId,
      emailMessageId: r.emailMessageId,
      threadId: r.threadId,
      from: r.from,
      subject: r.subject,
      receivedAt: r.receivedAt,
      company: r.company,
      jobTitle: r.jobTitle,
    },
  }));
}

/** One prep sheet per cycle; subject is the application it is generated for. */
export function buildInterviewPrepItems(preps: AgendaInterviewPrep[]): AgendaItem[] {
  return preps.slice(0, MAX_INTERVIEW_PREPS).map((p) => ({
    id: `interview.prep:${p.applicationId}`,
    kind: "interview.prep",
    priority: PRIORITY.interviewPrep,
    title: `Interview prep: ${p.jobTitle}`.slice(0, 200),
    subjectType: "application",
    subjectId: p.applicationId,
    payload: {
      applicationId: p.applicationId,
      company: p.company,
      jobTitle: p.jobTitle,
      jobUrl: p.jobUrl,
      resumeId: p.resumeId,
    },
  }));
}
