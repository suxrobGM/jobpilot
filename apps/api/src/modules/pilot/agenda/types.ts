import type { PilotMandateConfig } from "@jobpilot/contracts/pilot";

export interface AgendaEscalation {
  id: string;
  kind: string;
  question: string;
}

export interface WarmContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
}

export interface AgendaApprovedJob {
  campaignId: string;
  key: string;
  title: string;
  url: string;
  board: string | null;
  digest: string | null;
  matchScore: number | null;
  resumeId?: string;
  company?: string | null;
  /** Contacts at the job's company (attached by the warm-check join for high-score jobs). */
  warmContacts?: WarmContact[];
}

export interface AgendaDueQuery {
  query: string;
  board?: string;
  resumeId?: string;
}

export interface AgendaFinalizeCampaign {
  campaignId: string;
  query: string;
}

/** Unclassified synced emails awaiting a triage pass. */
export interface AgendaInbox {
  messageIds: string[];
  count: number;
}

export interface AgendaOutreachSend {
  campaignId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  subject: string | null;
  body: string;
}

export interface AgendaFollowup {
  campaignId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  subject: string | null;
  sentAt: Date;
  daysSince: number;
}

/** A promotion venue whose posting cadence is due (no post to attach to yet). */
export interface AgendaPromoVenue {
  venue: string;
  target?: string;
}

/** An approved promotion post ready to publish. */
export interface AgendaPromoPost {
  id: string;
  venue: string;
  target: string | null;
  title: string | null;
  body: string;
}

export interface AgendaInput {
  now: Date;
  config: PilotMandateConfig;
  openEscalations: number;
  answeredEscalations: AgendaEscalation[];
  activeLeases: number;
  approvedJobs: AgendaApprovedJob[];
  appliedToday: number;
  dueQueries: AgendaDueQuery[];
  finalizeCampaigns: AgendaFinalizeCampaign[];
  inbox: AgendaInbox;
  approvedOutreach: AgendaOutreachSend[];
  outreachSentToday: number;
  followups: AgendaFollowup[];
  dueVenues: AgendaPromoVenue[];
  approvedPromotions: AgendaPromoPost[];
}
