import {
  type PilotConfig,
  pilotConfigSchema,
  type TaskListContent,
  type TaskPayload,
  type TaskType,
} from "@jobpilot/contracts/pilot";
import type { z } from "zod/v4";
import type { TaskListInput } from "./build";
import type { TaskJob } from "./gather/jobs";
import type { Followup } from "./gather/outreach";
import type { ResearchTask } from "./gather/research";

type ConfigOverrides = z.input<typeof pilotConfigSchema>;
type WarmContact = NonNullable<TaskJob["warmContacts"]>[number];

// Networking is off by default, but these suites exercise it, so both channels start on here.
export const cfg = (over: ConfigOverrides = {}): PilotConfig =>
  pilotConfigSchema.parse({
    ...over,
    networking: { email: "review", linkedIn: "draft", ...over.networking },
  });

const NOW = new Date("2026-07-15T12:00:00.000Z");

export const base = (over: Partial<TaskListInput> = {}): TaskListInput => ({
  now: NOW,
  config: cfg(),
  autopilot: true,
  requests: [],
  chat: null,
  cycleCount: 0,
  openQuestions: 0,
  activeRuns: 0,
  appliedToday: 0,
  networkingSentToday: 0,
  awaitingSetup: true,
  nextSearchRunAt: null,
  answeredQuestions: [],
  approvedJobs: [],
  warmIntroCandidates: [],
  dueQueries: [],
  scorePending: [],
  queueScores: [],
  pausedFeeds: [],
  boardDiagnoses: [],
  inbox: { messageIds: [], count: 0 },
  jobAlerts: null,
  interviewReplies: [],
  interviewPreps: [],
  upworkSync: null,
  approvedNetworking: [],
  followups: [],
  feedTunes: [],
  rescanSkipped: [],
  retryFailed: [],
  setup: null,
  research: null,
  ...over,
});

export const job = (key: string, matchScore: number | null, over: Partial<TaskJob> = {}) => ({
  feedId: "c1",
  key,
  title: `Job ${key}`,
  url: `https://x/${key}`,
  board: null,
  brief: null,
  matchScore,
  company: null,
  capExemptBasis: null,
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
  feedId: "c1",
  messageId,
  contactId: `ct-${messageId}`,
  contactName: "Dana Recruiter",
  contactEmail: "dana@acme.test",
  subject: "Hi",
  body: "hello",
});

export const followup = (messageId: string): Followup => ({
  feedId: "c1",
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
  boardId: `${board}-id`,
  board,
  consecutiveFailures: 3,
  recentFailReasons: ["captcha"],
  testJob: null,
});

/** `null` leaves the search unpinned, so it rotates the configured boards. */
export const dueQuery = (query: string, board: string | null = "linkedin.com") => ({
  searchId: `s-${query}`,
  query,
  board: board ?? undefined,
});

export const pausedFeed = (feedId: string): TaskPayload<"search.review"> => ({
  feedId,
  query: "react",
  board: null,
  pausedAt: new Date("2026-07-14T12:00:00.000Z"),
});

export const queueScore = (feedId: string): TaskPayload<"queue.score"> => ({
  feedId,
  minScore: 60,
  queuedCount: 1,
  entries: [{ key: "q1", url: "https://x/1" }],
});

export const scorePending = (feedId: string): TaskPayload<"feed.score"> => ({
  feedId,
  query: "react",
  board: null,
  minScore: 60,
  pendingCount: 9,
  entries: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
});

export const tune = (feedId: string): TaskPayload<"search.tune"> => ({
  feedId,
  query: "react",
  config: { minScore: 70, board: "linkedin" },
  counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
  topSkipReasons: ["overqualified"],
});

export const setup: TaskPayload<"search.setup"> = { minScore: 60 };

export const research = (trigger: ResearchTask["trigger"]): ResearchTask => ({
  resumeId: "0f4b6a52-7c1e-4d8a-9b3f-2e5c6d7a8b90",
  minScore: 60,
  preferCapExempt: true,
  requiresSponsorship: true,
  boards: ["linkedin.com"],
  trigger,
});

type Tasks = Pick<TaskListContent, "tasks">;

export const findTask = (taskList: Tasks, taskType: TaskType) =>
  taskList.tasks.find((task) => task.taskType === taskType);

export const hasTaskType = (taskList: Tasks, taskType: TaskType) =>
  findTask(taskList, taskType) !== undefined;
