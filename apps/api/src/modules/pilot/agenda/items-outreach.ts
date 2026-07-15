import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { MAX_FOLLOWUPS, PRIORITY } from "./constants";
import type { AgendaFollowup, AgendaInbox, AgendaOutreachSend } from "./types";

/** Approved email sends, capped by the caller's remaining daily outreach headroom. */
export function buildOutreachSendItems(
  sends: AgendaOutreachSend[],
  headroom: number,
): AgendaItem[] {
  return sends.slice(0, headroom).map((m) => ({
    id: `outreach.send:${m.messageId}`,
    kind: "outreach.send",
    priority: PRIORITY.outreachSend,
    title: `Send outreach: ${m.contactName}`.slice(0, 200),
    subjectType: "outreach",
    subjectId: m.messageId,
    payload: {
      campaignId: m.campaignId,
      messageId: m.messageId,
      contactId: m.contactId,
      contactName: m.contactName,
      contactEmail: m.contactEmail,
      subject: m.subject,
      body: m.body,
    },
  }));
}

/** One batch triage item covers all pending unclassified mail. */
export function buildInboxItem(inbox: AgendaInbox): AgendaItem[] {
  if (inbox.count === 0) return [];
  return [
    {
      id: "inbox.triage",
      kind: "inbox.triage",
      priority: PRIORITY.inboxTriage,
      title: `Triage ${inbox.count} inbox message(s)`,
      subjectType: "inbox",
      subjectId: "inbox",
      payload: { messageIds: inbox.messageIds, count: inbox.count },
    },
  ];
}

/** Capped so one cycle can't drown in nudges; caller gates on remaining send headroom. */
export function buildFollowupItems(followups: AgendaFollowup[]): AgendaItem[] {
  return followups.slice(0, MAX_FOLLOWUPS).map((f) => ({
    id: `outreach.followup:${f.messageId}`,
    kind: "outreach.followup",
    priority: PRIORITY.followup,
    title: `Follow up: ${f.contactName}`.slice(0, 200),
    subjectType: "outreach",
    subjectId: f.messageId,
    payload: {
      campaignId: f.campaignId,
      messageId: f.messageId,
      contactId: f.contactId,
      contactName: f.contactName,
      contactEmail: f.contactEmail,
      subject: f.subject,
      sentAt: f.sentAt,
      daysSince: f.daysSince,
    },
  }));
}
