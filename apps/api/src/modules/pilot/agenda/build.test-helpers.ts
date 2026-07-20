// Pure builders for the agenda unit tests: contracts + local types only, so importing this never
// loads `@/env` and the builder suites stay database-free.
import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { AgendaInput } from "./types";

// Networking is opt-in in prod, but these builder suites predate the flag and assert networking behavior,
// so default it on here; a test that wants it off passes `networkingEnabled: false`.
export const cfg = (over: Record<string, unknown> = {}): PilotInstructionsConfig =>
  pilotInstructionsConfigSchema.parse({ networkingEnabled: true, ...over });

export const NOW = new Date("2026-07-15T12:00:00.000Z");

export const base = (over: Partial<AgendaInput> = {}): AgendaInput => ({
  now: NOW,
  config: cfg(),
  openQuestions: 0,
  answeredQuestions: [],
  activeLeases: 0,
  approvedJobs: [],
  appliedToday: 0,
  dueQueries: [],
  scorePending: [],
  finalizeCampaigns: [],
  inbox: { messageIds: [], count: 0 },
  approvedNetworking: [],
  networkingSentToday: 0,
  followups: [],
  duePlatforms: [],
  approvedPromotions: [],
  interviewReplies: [],
  interviewPreps: [],
  queue: { entries: [], pendingCount: 0 },
  boardHealth: [],
  strategyReviews: [],
  rescanSkipped: [],
  retryFailed: [],
  bootstrap: null,
  ...over,
});

export const job = (key: string, matchScore: number | null) => ({
  campaignId: "c1",
  key,
  title: `Job ${key}`,
  url: `https://x/${key}`,
  board: null,
  digest: null,
  matchScore,
});

export const send = (messageId: string, over: Record<string, unknown> = {}) => ({
  campaignId: "c1",
  messageId,
  contactId: `ct-${messageId}`,
  contactName: "Dana Recruiter",
  contactEmail: "dana@acme.test",
  subject: "Hi",
  body: "hello",
  ...over,
});

export const followup = (messageId: string, over: Record<string, unknown> = {}) => ({
  campaignId: "c1",
  messageId,
  contactId: `ct-${messageId}`,
  contactName: "Dana Recruiter",
  contactEmail: "dana@acme.test",
  subject: "Hi",
  sentAt: new Date("2026-07-08T12:00:00.000Z"),
  daysSince: 7,
  ...over,
});

export const reply = (emailMessageId: string, over: Record<string, unknown> = {}) => ({
  applicationId: `app-${emailMessageId}`,
  emailMessageId,
  threadId: `thr-${emailMessageId}`,
  from: "dana@acme.test",
  subject: "Interview availability?",
  receivedAt: new Date("2026-07-14T12:00:00.000Z"),
  company: "Acme",
  jobTitle: "Engineer",
  ...over,
});

export const prep = (applicationId: string, over: Record<string, unknown> = {}) => ({
  applicationId,
  company: "Acme",
  jobTitle: "Engineer",
  jobUrl: "https://x/1",
  resumeId: "r1",
  ...over,
});

export const boardHealth = (board: string, over: Record<string, unknown> = {}) => ({
  board,
  consecutiveFailures: 3,
  recentFailReasons: ["captcha"],
  probeJob: { campaignId: "c1", jobKey: "j1", url: "https://x/j1" },
  ...over,
});

export const bootstrapCandidate = (over: Record<string, unknown> = {}) => ({
  goals: "Senior TypeScript roles, remote",
  hasGoals: true,
  boards: ["linkedin"],
  minScore: 60,
  ...over,
});

export const strategyReview = (campaignId: string, over: Record<string, unknown> = {}) => ({
  campaignId,
  query: "react",
  minScore: 70,
  board: "linkedin",
  counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
  topSkipReasons: ["overqualified"],
  ...over,
});
