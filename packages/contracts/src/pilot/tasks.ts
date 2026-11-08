import { z } from "zod/v4";
import { jobBriefSchema } from "../feed";
import { networkingModeSchema } from "../networking";
import { storedDate } from "../utils/json";

// An "off" channel is never emitted, so a worker only ever sees a resolved channel and mode.
const outgoingMode = networkingModeSchema.shape;

export const PILOT_SUBJECT_TYPES = [
  "job",
  "feed",
  "question",
  "networking",
  "inbox",
  "application",
  "email",
  "board",
  "pilot",
  "upwork",
  "chat",
  "resume",
  // Work with no record of its own, keyed by the request that asked for it.
  "request",
] as const;
export const pilotSubjectTypeSchema = z.enum(PILOT_SUBJECT_TYPES);
type PilotSubjectType = (typeof PILOT_SUBJECT_TYPES)[number];

const nullableString = z.string().nullable();
const optionalString = z.string().optional();
const warmContactSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  title: nullableString,
  email: nullableString,
});

const taskVariant = <K extends string, P extends z.ZodType>(
  taskType: K,
  subjectType: (typeof PILOT_SUBJECT_TYPES)[number],
  payload: P,
) =>
  z.object({
    taskType: z.literal(taskType),
    subjectType: z.literal(subjectType),
    subjectId: z.string(),
    payload,
  });

export const taskFieldsSchema = z.discriminatedUnion("taskType", [
  taskVariant(
    "question.answered",
    "question",
    z.object({
      questionId: z.uuid(),
      questionKind: z.string(),
      subjectType: pilotSubjectTypeSchema.nullable(),
      subjectId: nullableString,
      prompt: z.string(),
      answer: nullableString,
    }),
  ),
  taskVariant(
    "job.apply",
    "job",
    z.object({
      feedId: z.uuid(),
      jobKey: z.string(),
      jobTitle: z.string(),
      url: z.string(),
      board: nullableString,
      brief: jobBriefSchema.nullable(),
      resumeId: z.uuid().optional(),
      matchScore: z.number().nullable(),
      warmContacts: z.array(warmContactSchema).optional(),
    }),
  ),
  taskVariant(
    "search.discover",
    "feed",
    z.object({
      searchId: z.uuid(),
      query: z.string(),
      board: optionalString,
      resumeId: z.uuid().optional(),
      minScore: z.number(),
      newJobsTarget: z.number().int(),
      maxPages: z.number().int(),
    }),
  ),
  taskVariant(
    "feed.score",
    "feed",
    z.object({
      feedId: z.uuid(),
      query: z.string(),
      board: nullableString,
      resumeId: z.uuid().optional(),
      minScore: z.number(),
      pendingCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string(), title: z.string() })),
    }),
  ),
  taskVariant(
    "search.review",
    "feed",
    z.object({
      feedId: z.uuid(),
      query: z.string(),
      board: nullableString,
      // The feed's last update, which approximates when it was paused.
      pausedAt: storedDate,
    }),
  ),
  taskVariant(
    "inbox.review",
    "inbox",
    z.object({ messageIds: z.array(z.string()), count: z.number().int() }),
  ),
  taskVariant(
    "inbox.jobAlerts",
    "inbox",
    z.object({
      // Oldest first, capped per run; `count` is every unimported alert email in the window.
      messageIds: z.array(z.string()),
      count: z.number().int(),
      minScore: z.number(),
      senderDomains: z.array(z.string()),
    }),
  ),
  taskVariant(
    "networking.send",
    "networking",
    z.object({
      feedId: z.uuid(),
      messageId: z.uuid(),
      contactId: z.uuid(),
      contactName: z.string(),
      contactEmail: z.string(),
      subject: nullableString,
      body: z.string(),
    }),
  ),
  taskVariant(
    "networking.followup",
    "networking",
    z.object({
      feedId: z.uuid(),
      messageId: z.uuid(),
      contactId: z.uuid(),
      contactName: z.string(),
      contactEmail: z.string(),
      subject: nullableString,
      sentAt: storedDate,
      daysSince: z.number().int(),
      ...outgoingMode,
    }),
  ),
  taskVariant(
    "networking.warmIntro",
    "networking",
    z.object({
      feedId: z.uuid(),
      jobKey: z.string(),
      company: nullableString,
      jobTitle: z.string(),
      jobUrl: z.string(),
      // Empty when nobody at the company is known yet; the worker discovers one.
      contacts: z.array(warmContactSchema).default([]),
      ...outgoingMode,
    }),
  ),
  taskVariant(
    "interview.reply",
    "email",
    z.object({
      applicationId: z.uuid(),
      emailMessageId: z.uuid(),
      threadId: nullableString,
      from: z.string(),
      subject: z.string(),
      receivedAt: storedDate,
      company: z.string(),
      jobTitle: z.string(),
    }),
  ),
  taskVariant(
    "interview.prep",
    "application",
    z.object({
      applicationId: z.uuid(),
      company: z.string(),
      jobTitle: z.string(),
      jobUrl: nullableString,
      resumeId: z.uuid().nullable(),
    }),
  ),
  taskVariant(
    "queue.score",
    "feed",
    z.object({
      feedId: z.uuid(),
      resumeId: z.uuid().optional(),
      minScore: z.number(),
      queuedCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string() })),
    }),
  ),
  taskVariant(
    "upwork.syncInbox",
    "upwork",
    z.object({
      lastSyncedAt: storedDate.nullable(),
      unreadCount: z.number().int(),
    }),
  ),
  taskVariant(
    "board.diagnose",
    "board",
    z.object({
      boardId: z.uuid(),
      /** The board's domain. */
      board: z.string(),
      consecutiveFailures: z.number().int(),
      recentFailReasons: z.array(z.string()),
      testJob: z.object({ feedId: z.uuid(), jobKey: z.string(), url: z.string() }).nullable(),
    }),
  ),
  taskVariant(
    "search.tune",
    "feed",
    z.object({
      feedId: z.uuid(),
      query: z.string(),
      config: z.object({ minScore: z.number().nullable(), board: nullableString }),
      counts: z.object({
        totalFound: z.number().int(),
        qualified: z.number().int(),
        applied: z.number().int(),
        skipped: z.number().int(),
      }),
      topSkipReasons: z.array(z.string()),
    }),
  ),
  taskVariant(
    "job.rescanSkipped",
    "feed",
    z.object({
      feedId: z.uuid(),
      skippedCount: z.number().int(),
      // Set when the user picked jobs; otherwise every skipped job of the feed.
      jobKeys: z.array(z.string()).optional(),
    }),
  ),
  taskVariant(
    "job.retryFailed",
    "feed",
    z.object({ feedId: z.uuid(), failedCount: z.number().int() }),
  ),
  taskVariant(
    "search.setup",
    "pilot",
    // `requested`: the user asked, so build from every resume and keep what's there.
    z.object({ minScore: z.number(), trigger: z.enum(["requested", "auto"]) }),
  ),
  taskVariant(
    "research.explore",
    "pilot",
    z.object({
      resumeId: z.uuid(),
      minScore: z.number(),
      preferCapExempt: z.boolean(),
      requiresSponsorship: z.boolean(),
      // Already searched by `search.discover`; research looks beyond them.
      boards: z.array(z.string()),
      newJobsTarget: z.number().int(),
      trigger: z.enum(["requested", "initial", "dry", "periodic"]),
      focus: z.string().optional(),
    }),
  ),
  taskVariant("chat.reply", "chat", z.object({ messageId: z.uuid() })),
  taskVariant("resume.extract", "resume", z.object({ resumeId: z.uuid(), force: z.boolean() })),
  taskVariant(
    "resume.tailor",
    "request",
    z.object({
      requestId: z.uuid(),
      jobDescription: z.string(),
      baseResumeId: z.uuid().optional(),
    }),
  ),
  taskVariant(
    "networking.find",
    "request",
    z.object({ requestId: z.uuid(), criteria: z.string() }),
  ),
  taskVariant(
    "networking.rewrite",
    "request",
    z.object({ requestId: z.uuid(), messageIds: z.array(z.uuid()) }),
  ),
  taskVariant("upwork.profile", "upwork", z.object({ mode: z.enum(["review", "apply"]) })),
  taskVariant("upwork.proposal", "upwork", z.object({ proposalId: z.uuid() })),
  taskVariant("upwork.submit", "upwork", z.object({ proposalId: z.uuid() })),
]);

type TaskFields = z.infer<typeof taskFieldsSchema>;

/** Each task type's subject type, read off its variant so it is declared once. */
export const TASK_SUBJECT_TYPES = Object.fromEntries(
  taskFieldsSchema.options.map((variant) => [
    variant.shape.taskType.value,
    variant.shape.subjectType.value,
  ]),
) as Record<TaskType, PilotSubjectType>;
export type TaskType = TaskFields["taskType"];
export type TaskPayload<K extends TaskType> = Extract<TaskFields, { taskType: K }>["payload"];

const taskSchema = z.intersection(
  z.object({ id: z.string(), priority: z.number(), title: z.string() }),
  taskFieldsSchema,
);

const taskListContentSchema = z.object({
  builtAt: storedDate,
  tasks: z.array(taskSchema),
  counts: z.object({
    openQuestions: z.number().int(),
    activeRuns: z.number().int(),
    approvedJobs: z.number().int(),
    appliedToday: z.number().int(),
  }),
  budget: z.object({
    dailyApplyCap: z.number().int(),
    appliedToday: z.number().int(),
    capReached: z.boolean(),
    dailyNetworkingCap: z.number().int(),
    networkingSentToday: z.number().int(),
    resetsAt: storedDate,
  }),
  emptyReason: z.enum(["capReached", "awaitingSetup", "autopilotOff", "clear"]).nullable(),
  sleepSeconds: z.number(),
  nextWakeAt: storedDate,
});

export const taskListSchema = taskListContentSchema.extend({
  version: z.uuid(),
  expiresAt: storedDate,
});

export const currentTaskListSchema = z.object({ taskList: taskListSchema.nullable() });

export type PilotTask = z.infer<typeof taskSchema>;
export type TaskListContent = z.infer<typeof taskListContentSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
