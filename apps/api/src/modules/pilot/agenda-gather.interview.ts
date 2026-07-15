import type { CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AgendaInterviewPrep, AgendaInterviewReply } from "./agenda/types";

/** Prefix marking an ApplicationEvent note as a generated interview prep sheet. */
const INTERVIEW_PREP_MARKER = "[interview-prep]";

/**
 * Interviewing apps whose recruiter reply still needs an availability answer: the app has an
 * interview-classified inbound email, no outbound reply logged (an `email` event), and no
 * open/answered escalation on that email (a draft in flight or already approved).
 */
export async function gatherInterviewReplies(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaInterviewReply[]> {
  const apps = await prisma.application.findMany({
    where: { profileId, status: "interviewing" },
    select: {
      id: true,
      company: true,
      title: true,
      // An outbound reply is logged as an `email` activity event; its presence means we already replied.
      events: { where: { kind: "email" }, select: { id: true }, take: 1 },
      emailMessages: {
        where: { classification: "interviewing" },
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: { id: true, threadId: true, fromAddress: true, subject: true, receivedAt: true },
      },
    },
  });

  const candidates = apps
    .filter((a) => a.events.length === 0 && a.emailMessages.length > 0)
    .map((a) => ({ app: a, email: a.emailMessages[0] }));
  if (candidates.length === 0) return [];

  // Suppress any email that already has a reply draft escalation (open) or an approved one (answered).
  const escalations = await prisma.escalation.findMany({
    where: {
      profileId,
      subjectType: "email",
      subjectId: { in: candidates.map((c) => c.email.id) },
      status: { in: ["open", "answered"] },
    },
    select: { subjectId: true },
  });
  const blocked = new Set(escalations.map((e) => e.subjectId));

  return candidates
    .filter((c) => !blocked.has(c.email.id))
    .map((c) => ({
      applicationId: c.app.id,
      emailMessageId: c.email.id,
      threadId: c.email.threadId,
      from: c.email.fromAddress,
      subject: c.email.subject,
      receivedAt: c.email.receivedAt,
      company: c.app.company,
      jobTitle: c.app.title,
    }));
}

/** Interviewing apps with no prep-sheet note yet, each carrying its campaign's resumeId when derivable. */
export async function gatherInterviewPreps(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaInterviewPrep[]> {
  const apps = await prisma.application.findMany({
    where: {
      profileId,
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

  return apps.map((a) => {
    let resumeId: string | null = null;
    if (a.campaign?.config) {
      try {
        resumeId = (JSON.parse(a.campaign.config) as CampaignConfig).resumeId ?? null;
      } catch {
        resumeId = null;
      }
    }
    return {
      applicationId: a.id,
      company: a.company,
      jobTitle: a.title,
      jobUrl: a.url,
      resumeId,
    };
  });
}
