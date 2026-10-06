import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
  type TaskListContent,
  type TaskPayload,
  type TaskType,
} from "@jobpilot/contracts/pilot";
import type { z } from "zod/v4";
import type { TaskListInput } from "./build";
import type { TaskJob } from "./gather-jobs";
import type { Followup } from "./gather-outreach";

type ConfigOverrides = z.input<typeof pilotInstructionsConfigSchema>;
type WarmContact = NonNullable<TaskJob["warmContacts"]>[number];

// Networking is off by default, but these suites exercise it, so both channels start on here.
export const cfg = (over: ConfigOverrides = {}): PilotInstructionsConfig =>
  pilotInstructionsConfigSchema.parse({
    ...over,
    networking: { email: "review", linkedIn: "draft", ...over.networking },
  });

const NOW = new Date("2026-07-15T12:00:00.000Z");

export const base = (over: Partial<TaskListInput> = {}): TaskListInput => ({
  now: NOW,
  config: cfg(),
  cycleCount: 0,
  openQuestions: 0,
  activeRuns: 0,
  appliedToday: 0,
  applyingNow: 0,
  networkingSentToday: 0,
  awaitingSetup: true,
  nextSearchRunAt: null,
  answeredQuestions: [],
  approvedJobs: [],
  warmIntroCandidates: [],
  dueQueries: [],
  scorePending: [],
  queueScores: [],
  pausedCampaigns: [],
  boardDiagnose: [],
  inbox: { messageIds: [], count: 0 },
  interviewReplies: [],
  interviewPreps: [],
  upworkSync: null,
  approvedNetworking: [],
  followups: [],
  approvedPromotions: [],
  duePlatforms: [],
  campaignTunes: [],
  rescanSkipped: [],
  retryFailed: [],
  setup: null,
  ...over,
});

export const job = (key: string, matchScore: number | null, over: Partial<TaskJob> = {}) => ({
  campaignId: "c1",
  key,
  title: `Job ${key}`,
  url: `https://x/${key}`,
  board: null,
  brief: null,
  matchScore,
  company: null,
  ...over,
});

export const contact = (id: string): WarmContact => ({
  id,
  name: "Insider",
  title: null,
  email: `${id}@acme.test`,
});

/** A job strong enough for the warm-intro pool. */
export const hotJob = (key: string, matchScore: number, warmContacts?: WarmContact[]) =>
  job(key, matchScore, { company: "Acme", warmContacts });

export const question = (id: string): TaskPayload<"question.answered"> => ({
  questionId: id,
  questionKind: "question",
  subjectType: null,
  subjectId: null,
  prompt: "Which start date?",
  answer: "Two weeks",
});

export const send = (messageId: string): TaskPayload<"networking.send"> => ({
  campaignId: "c1",
  messageId,
  contactId: `ct-${messageId}`,
  contactName: "Dana Recruiter",
  contactEmail: "dana@acme.test",
  subject: "Hi",
  body: "hello",
});

export const followup = (messageId: string): Followup => ({
  campaignId: "c1",
  messageId,
  contactId: `ct-${messageId}`,
  contactName: "Dana Recruiter",
  contactEmail: "dana@acme.test",
  subject: "Hi",
  sentAt: new Date("2026-07-08T12:00:00.000Z"),
  daysSince: 7,
});

export const reply = (emailMessageId: string): TaskPayload<"interview.reply"> => ({
  applicationId: `app-${emailMessageId}`,
  emailMessageId,
  threadId: null,
  from: "dana@acme.test",
  subject: "Interview availability?",
  receivedAt: new Date("2026-07-14T12:00:00.000Z"),
  company: "Acme",
  jobTitle: "Engineer",
});

export const prep = (applicationId: string): TaskPayload<"interview.prep"> => ({
  applicationId,
  company: "Acme",
  jobTitle: "Engineer",
  jobUrl: "https://x/1",
  resumeId: null,
});

export const boardDiagnose = (board: string): TaskPayload<"board.diagnose"> => ({
  board,
  consecutiveFailures: 3,
  recentFailReasons: ["captcha"],
  testJob: null,
});

export const dueQuery = (query: string, board?: string) => ({
  searchId: `s-${query}`,
  query,
  board,
});

export const pausedCampaign = (campaignId: string): TaskPayload<"campaign.reviewPaused"> => ({
  campaignId,
  query: "react",
  board: null,
  pausedAt: new Date("2026-07-14T12:00:00.000Z"),
});

export const queueScore = (campaignId: string): TaskPayload<"queue.score"> => ({
  campaignId,
  minScore: 60,
  queuedCount: 1,
  entries: [{ key: "q1", url: "https://x/1" }],
});

export const scorePending = (campaignId: string): TaskPayload<"campaign.scorePending"> => ({
  campaignId,
  query: "react",
  board: null,
  minScore: 60,
  pendingCount: 9,
  entries: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
});

export const tune = (campaignId: string): TaskPayload<"campaign.tune"> => ({
  campaignId,
  query: "react",
  config: { minScore: 70, board: "linkedin" },
  counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
  topSkipReasons: ["overqualified"],
});

export const setup: TaskPayload<"search.setup"> = {
  goals: "Senior TypeScript roles, remote",
  minScore: 60,
};

type Tasks = Pick<TaskListContent, "tasks">;

export const findTask = (taskList: Tasks, taskType: TaskType) =>
  taskList.tasks.find((task) => task.taskType === taskType);

export const hasTaskType = (taskList: Tasks, taskType: TaskType) =>
  findTask(taskList, taskType) !== undefined;
