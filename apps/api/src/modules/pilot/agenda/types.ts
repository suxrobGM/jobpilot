import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";

export interface AgendaQuestion {
  id: string;
  kind: string;
  prompt: string;
  // Enrichment so question.answered claims carry the subject and Q/A without the worker re-reading.
  subjectType?: string | null;
  subjectId?: string | null;
  answer?: string | null;
}

/** An interviewing app whose recruiter reply is unanswered - the availability-reply draft candidate. */
export interface AgendaInterviewReply {
  applicationId: string;
  emailMessageId: string;
  threadId: string | null;
  from: string;
  subject: string;
  receivedAt: Date;
  company: string;
  jobTitle: string;
}

/** An interviewing app with no prep sheet yet. */
export interface AgendaInterviewPrep {
  applicationId: string;
  company: string;
  jobTitle: string;
  jobUrl: string | null;
  resumeId: string | null;
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
  /** The PilotSearch row id - the discover item's id and claim subject. */
  searchId: string;
  query: string;
  board?: string;
  resumeId?: string;
  /** Existing in-progress campaign for this query - discovery reuses it instead of creating one. */
  campaignId?: string;
}

/** A paused auto-apply campaign with no open/undecided review question - the review candidate. */
export interface AgendaPausedCampaign {
  campaignId: string;
  query: string;
  board: string | null;
  pausedAt: Date;
}

/** An in-progress auto-apply campaign carrying pending rows still missing a score or a digest
 * (≤5 sampled entries). */
export interface AgendaScorePending {
  campaignId: string;
  query: string;
  board: string | null;
  resumeId?: string;
  minScore: number;
  pendingCount: number;
  entries: { key: string; url: string; title: string }[];
}

/** Unclassified synced emails awaiting a review pass. */
export interface AgendaInbox {
  messageIds: string[];
  count: number;
}

export interface AgendaNetworkingSend {
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

/** A promotion platform whose posting cadence is due (no post to attach to yet). */
export interface AgendaPromoPlatform {
  platform: string;
  target?: string;
}

/** An approved promotion post ready to publish. */
export interface AgendaPromoPost {
  id: string;
  platform: string;
  target: string | null;
  title: string | null;
  body: string;
}

/** An in-progress apply campaign holding pasted links nothing has visited yet (≤5 sampled entries). */
export interface AgendaQueueDrain {
  campaignId: string;
  resumeId?: string;
  minScore: number;
  queuedCount: number;
  entries: { key: string; url: string }[];
}

/** A board whose most recent apply outcomes are a failure streak - a board-health warning candidate. */
export interface AgendaBoardHealth {
  board: string;
  consecutiveFailures: number;
  recentFailReasons: string[];
  probeJob: { campaignId: string; jobKey: string; url: string } | null;
}

/** An in-progress campaign converting poorly (low qualified ratio) - a strategy-review candidate. */
export interface AgendaStrategyReview {
  campaignId: string;
  query: string;
  minScore: number | null;
  board: string | null;
  counts: { totalFound: number; qualified: number; applied: number; skipped: number };
  topSkipReasons: string[];
}

/** A campaign with a backlog of skipped jobs worth re-scanning. */
export interface AgendaRescanSkipped {
  campaignId: string;
  skippedCount: number;
}

/** A campaign with a backlog of failed jobs worth retrying. */
export interface AgendaRetryFailed {
  campaignId: string;
  failedCount: number;
}

/** Empty pipeline + zero searches: the agent derives searches from goals, or asks when goals are blank. */
export interface AgendaStrategyBootstrap {
  goals: string;
  minScore: number;
}

export interface AgendaInput {
  now: Date;
  config: PilotInstructionsConfig;
  // Cycles completed so far - the rotation offset that moves discovery across the configured boards.
  cycleCount: number;
  openQuestions: number;
  answeredQuestions: AgendaQuestion[];
  activeClaims: number;
  approvedJobs: AgendaApprovedJob[];
  // Warm-intro pool: approved jobs at/above the floor plus recently-applied ones, claim-damped.
  warmIntroCandidates: AgendaApprovedJob[];
  appliedToday: number;
  dueQueries: AgendaDueQuery[];
  // No searches yet, or no goals to derive them from: the pilot still needs setup.
  awaitingSetup: boolean;
  // Earliest nextRunAt across live searches; the idle sleep clamps to it so a backed-off pilot wakes on time.
  nextSearchRunAt: Date | null;
  // Existing campaigns with pending rows lacking a score or digest; emitted only when the apply
  // pipeline is empty.
  scorePending: AgendaScorePending[];
  // Paused campaigns needing a resume-or-ask decision; emitted ungated so they can't be starved.
  pausedCampaigns: AgendaPausedCampaign[];
  inbox: AgendaInbox;
  approvedNetworking: AgendaNetworkingSend[];
  networkingSentToday: number;
  followups: AgendaFollowup[];
  duePlatforms: AgendaPromoPlatform[];
  approvedPromotions: AgendaPromoPost[];
  interviewReplies: AgendaInterviewReply[];
  interviewPreps: AgendaInterviewPrep[];
  queueDrains: AgendaQueueDrain[];
  boardHealth: AgendaBoardHealth[];
  // Quiet-agenda candidates: only surface when no apply/discover/queue work is queued.
  strategyReviews: AgendaStrategyReview[];
  rescanSkipped: AgendaRescanSkipped[];
  retryFailed: AgendaRetryFailed[];
  bootstrap: AgendaStrategyBootstrap | null;
}
