// Pure builders for the agenda unit tests: contracts + local types only, so importing this never
// loads `@/env` and the builder suites stay database-free.
import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { z } from "zod/v4";
import type { AgendaInput } from "./types";

type ConfigOverrides = z.input<typeof pilotInstructionsConfigSchema>;

// Networking is off by default in prod, but these suites assert networking behavior, so both
// channels default on here; a test that wants one off overrides just that key.
export const cfg = (over: ConfigOverrides = {}): PilotInstructionsConfig =>
  pilotInstructionsConfigSchema.parse({
    ...over,
    networking: { email: "review", linkedIn: "draft", ...over.networking },
  });

export const NOW = new Date("2026-07-15T12:00:00.000Z");

export const base = (over: Partial<AgendaInput> = {}): AgendaInput => ({
  now: NOW,
  config: cfg(),
  cycleCount: 0,
  openQuestions: 0,
  answeredQuestions: [],
  activeClaims: 0,
  approvedJobs: [],
  warmIntroCandidates: [],
  appliedToday: 0,
  dueQueries: [],
  awaitingSetup: true,
  nextSearchRunAt: null,
  scorePending: [],
  pausedCampaigns: [],
  inbox: { messageIds: [], count: 0 },
  approvedNetworking: [],
  networkingSentToday: 0,
  followups: [],
  duePlatforms: [],
  approvedPromotions: [],
  interviewReplies: [],
  interviewPreps: [],
  queueDrains: [],
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
  minScore: 60,
  ...over,
});

/** A due discovery entry; `searchId` is the PilotSearch row id (the item id + claim subject). */
export const dueQuery = (query: string, over: Record<string, unknown> = {}) => ({
  searchId: `s-${query}`,
  query,
  ...over,
});

export const pausedCampaign = (campaignId: string, over: Record<string, unknown> = {}) => ({
  campaignId,
  query: "react",
  board: null,
  pausedAt: new Date("2026-07-14T12:00:00.000Z"),
  ...over,
});

/** An apply campaign holding pasted links; `entries` are the sampled `queued` rows. */
export const queueDrain = (campaignId: string, over: Record<string, unknown> = {}) => ({
  campaignId,
  query: "Pasted links",
  minScore: 60,
  queuedCount: 1,
  entries: [{ key: "q1", url: "https://x/1" }],
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
