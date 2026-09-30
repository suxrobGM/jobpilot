import type { NetworkingAutonomy } from "@jobpilot/contracts/networking";
import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { MAX_FOLLOWUPS, PRIORITY } from "./constants";
import type { AgendaFollowup, AgendaInbox, AgendaJobAlerts, AgendaNetworkingSend } from "./types";

/** Approved email sends, capped by how many the caller has left under today's networking cap. */
export function buildNetworkingSendItems(
  sends: AgendaNetworkingSend[],
  sendsLeft: number,
): AgendaItem[] {
  return sends.slice(0, sendsLeft).map((m) => ({
    id: `networking.send:${m.messageId}`,
    kind: "networking.send",
    priority: PRIORITY.networkingSend,
    title: `Send networking message: ${m.contactName}`.slice(0, 200),
    subjectType: "networking",
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

/** One batch review item covers all pending unclassified mail. */
export function buildInboxItem(inbox: AgendaInbox): AgendaItem[] {
  if (inbox.count === 0) return [];
  return [
    {
      id: "inbox.review",
      kind: "inbox.review",
      priority: PRIORITY.inboxReview,
      title: `Review ${inbox.count} inbox message(s)`,
      subjectType: "inbox",
      subjectId: "inbox",
      payload: { messageIds: inbox.messageIds, count: inbox.count },
    },
  ];
}

/** One harvest item per due slot; the threshold is the pilot-wide minimum score. */
export function buildJobAlertsItem(alerts: AgendaJobAlerts | null, minScore: number): AgendaItem[] {
  if (!alerts || alerts.count === 0) return [];
  return [
    {
      id: "inbox.jobAlerts",
      kind: "inbox.jobAlerts",
      priority: PRIORITY.jobAlerts,
      title: `Harvest job links from ${alerts.count} alert email(s)`,
      subjectType: "inbox",
      subjectId: "jobAlerts",
      payload: {
        messageIds: alerts.messageIds,
        count: alerts.count,
        minScore,
        senderDomains: alerts.senderDomains,
      },
    },
  ];
}

/** Capped so one cycle can't drown in nudges; caller gates on the sends left today. */
export function buildFollowupItems(
  followups: AgendaFollowup[],
  autonomy: NetworkingAutonomy,
): AgendaItem[] {
  return followups.slice(0, MAX_FOLLOWUPS).map((f) => ({
    id: `networking.followup:${f.messageId}`,
    kind: "networking.followup",
    priority: PRIORITY.followup,
    title: `Follow up: ${f.contactName}`.slice(0, 200),
    subjectType: "networking",
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
      // A followup nudges an existing email thread, so it never switches channel.
      channel: "email",
      autonomy,
    },
  }));
}
