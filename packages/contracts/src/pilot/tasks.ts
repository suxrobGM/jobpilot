import { z } from "zod/v4";
import { networkingModeSchema } from "../networking";

// An "off" channel is never emitted, so a worker only ever sees a resolved channel and mode.
const outgoingMode = networkingModeSchema.shape;

const TASK_SUBJECT_TYPES = [
  "job",
  "campaign",
  "question",
  "networking",
  "inbox",
  "promotion",
  "application",
  "email",
  "board",
  "pilot",
  "upwork",
] as const;

const nullableString = z.string().nullable();
const optionalString = z.string().optional();
const warmContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: nullableString,
  email: nullableString,
});

const jobApplyPayloadSchema = z.object({
  campaignId: z.string(),
  jobKey: z.string(),
  url: z.string(),
  board: nullableString,
  brief: nullableString,
  resumeId: optionalString,
  matchScore: z.number().nullable(),
  warmContacts: z.array(warmContactSchema).optional(),
});

const taskVariant = <K extends string, P extends z.ZodType>(
  taskType: K,
  subjectType: (typeof TASK_SUBJECT_TYPES)[number],
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
      questionId: z.string(),
      questionKind: z.string(),
      subjectType: nullableString,
      subjectId: nullableString,
      prompt: z.string(),
      answer: nullableString,
    }),
  ),
  taskVariant("job.apply", "job", jobApplyPayloadSchema),
  // One approved job per campaign, applied side by side in its own browser; only above one concurrent apply.
  taskVariant("job.applyBatch", "pilot", z.object({ jobs: z.array(jobApplyPayloadSchema).min(1) })),
  taskVariant(
    "search.discover",
    "campaign",
    z.object({
      searchId: z.string(),
      query: z.string(),
      board: optionalString,
      resumeId: optionalString,
      minScore: z.number(),
      campaignId: optionalString,
      newJobsTarget: z.number().int(),
      maxPages: z.number().int(),
    }),
  ),
  taskVariant(
    "campaign.scorePending",
    "campaign",
    z.object({
      campaignId: z.string(),
      query: z.string(),
      board: nullableString,
      resumeId: optionalString,
      minScore: z.number(),
      pendingCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string(), title: z.string() })),
    }),
  ),
  taskVariant(
    "campaign.reviewPaused",
    "campaign",
    z.object({
      campaignId: z.string(),
      query: z.string(),
      board: nullableString,
      // The campaign's last update, which approximates when it was paused.
      pausedAt: z.date(),
    }),
  ),
  taskVariant(
    "inbox.review",
    "inbox",
    z.object({ messageIds: z.array(z.string()), count: z.number().int() }),
  ),
  taskVariant(
    "networking.send",
    "networking",
    z.object({
      campaignId: z.string(),
      messageId: z.string(),
      contactId: z.string(),
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
      campaignId: z.string(),
      messageId: z.string(),
      contactId: z.string(),
      contactName: z.string(),
      contactEmail: z.string(),
      subject: nullableString,
      sentAt: z.date(),
      daysSince: z.number().int(),
      ...outgoingMode,
    }),
  ),
  taskVariant(
    "networking.warmIntro",
    "networking",
    z.object({
      campaignId: z.string(),
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
    "promotion.draft",
    "promotion",
    z.object({ platform: z.string(), target: optionalString }),
  ),
  taskVariant(
    "promotion.post",
    "promotion",
    z.object({
      promotionId: z.string(),
      platform: z.string(),
      target: nullableString,
      title: nullableString,
      body: z.string(),
    }),
  ),
  taskVariant(
    "interview.reply",
    "email",
    z.object({
      applicationId: z.string(),
      emailMessageId: z.string(),
      threadId: nullableString,
      from: z.string(),
      subject: z.string(),
      receivedAt: z.date(),
      company: z.string(),
      jobTitle: z.string(),
    }),
  ),
  taskVariant(
    "interview.prep",
    "application",
    z.object({
      applicationId: z.string(),
      company: z.string(),
      jobTitle: z.string(),
      jobUrl: nullableString,
      resumeId: nullableString,
    }),
  ),
  taskVariant(
    "queue.score",
    "campaign",
    z.object({
      campaignId: z.string(),
      resumeId: optionalString,
      minScore: z.number(),
      queuedCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string() })),
    }),
  ),
  taskVariant(
    "upwork.syncInbox",
    "upwork",
    z.object({
      lastSyncedAt: z.date().nullable(),
      unreadCount: z.number().int(),
    }),
  ),
  taskVariant(
    "board.diagnose",
    "board",
    z.object({
      board: z.string(),
      consecutiveFailures: z.number().int(),
      recentFailReasons: z.array(z.string()),
      testJob: z.object({ campaignId: z.string(), jobKey: z.string(), url: z.string() }).nullable(),
    }),
  ),
  taskVariant(
    "campaign.tune",
    "campaign",
    z.object({
      campaignId: z.string(),
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
    "campaign",
    z.object({ campaignId: z.string(), skippedCount: z.number().int() }),
  ),
  taskVariant(
    "job.retryFailed",
    "campaign",
    z.object({ campaignId: z.string(), failedCount: z.number().int() }),
  ),
  taskVariant(
    "search.setup",
    "pilot",
    z.object({
      goals: z.string(),
      minScore: z.number(),
    }),
  ),
]);

type TaskFields = z.infer<typeof taskFieldsSchema>;
export type TaskType = TaskFields["taskType"];
export type TaskPayload<K extends TaskType> = Extract<TaskFields, { taskType: K }>["payload"];

const taskSchema = z.intersection(
  z.object({ id: z.string(), priority: z.number(), title: z.string() }),
  taskFieldsSchema,
);

const taskListContentSchema = z.object({
  builtAt: z.date(),
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
    /** How many applies may run side by side; 1 is the serial loop. */
    maxConcurrentApplies: z.number().int(),
    applyingNow: z.number().int(),
    dailyNetworkingCap: z.number().int(),
    networkingSentToday: z.number().int(),
    resetsAt: z.date(),
  }),
  emptyReason: z.enum(["capReached", "awaitingSetup", "clear"]).nullable(),
  sleepSeconds: z.number(),
  nextWakeAt: z.date(),
});

export const taskListSchema = taskListContentSchema.extend({
  version: z.uuid(),
  expiresAt: z.date(),
});

export const currentTaskListSchema = z.object({ taskList: taskListSchema.nullable() });

export type PilotTask = z.infer<typeof taskSchema>;
export type TaskListContent = z.infer<typeof taskListContentSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
