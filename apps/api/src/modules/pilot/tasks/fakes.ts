import type { TaskType } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import type { JobService } from "@/modules/feed/jobs/job.service";
import { makePush, type SentPush } from "@/modules/web-push/web-push.fake";
import type { PilotJournalService } from "../thread/journal.service";
import { DigestService } from "./digest.service";
import { PilotMaintenanceService } from "./maintenance.service";
import { TaskListService } from "./task-list.service";

type Row = Record<string, unknown>;

/** A prior run of one task type, as the dampers read it back. */
interface RunRow {
  subjectId: string;
  startedAt: Date;
  finishedAt: Date | null;
  outcome?: string | null;
}

type LatestRun = Omit<RunRow, "subjectId" | "startedAt"> & { startedAt?: Date };

interface Recorder {
  settleScored: unknown[][];
  journals: Row[];
  pushes: SentPush[];
  inboxSyncs: { userId: string; staleMs: number }[];
}

export interface Over {
  /** Prior runs per task type, for the per-subject dampers. */
  runs?: Partial<Record<TaskType, RunRow[]>>;
  /** The latest run per task type, for the once-per-user dampers. */
  latestRuns?: Partial<Record<TaskType, LatestRun | null>>;
  config?: unknown;
  /** Resumes on file; the first searches come from one. */
  resumeCount?: number;
  jobAlertEmails?: { id: string }[];
  appliedToday?: number;
  pilotSearches?: Row[];
  answered?: Row[];
  approvedJobs?: Row[];
  recentAppliedJobs?: Row[];
  contacts?: Row[];
  pausedFeeds?: string[];
  primaryResumeId?: string | null;
  profile?: { requiresSponsorship: boolean } | null;
  pendingRequests?: Record<string, unknown>[];
  scorePendingFeeds?: Row[];
  scoredPendingJobs?: Row[];
  pausedSearches?: Row[];
  feedQuestions?: { subjectId: string; status: string; answeredAt: Date | null }[];
  queuedFeeds?: Row[];
  boardDiagnoseJobs?: Row[];
  interviewReplyApps?: Row[];
  interviewPrepApps?: Row[];
  interviewQuestions?: { subjectId: string }[];
  upworkAccount?: { lastSyncedAt: Date | null } | null;
  upworkProfiles?: number;
  upworkUnread?: number;
  quietFeeds?: Row[];
  quietJobCounts?: Row[];
  skipReasonRows?: { feedId: string; skipReason: string | null; _count: { _all: number } }[];
  existingDigests?: number;
  digestApps?: number;
  jobsFailed?: number;
  jobsSkipped?: number;
  networkingSent?: number;
  networkingReplies?: number;
}

function fakePilotRun(over: Over) {
  return {
    findMany: async (a: { where: { taskType: TaskType } }) => over.runs?.[a.where.taskType] ?? [],
    findFirst: async (a: { where: { taskType: TaskType } }) =>
      over.latestRuns?.[a.where.taskType] ?? null,
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
  };
}

function fakePilotQuestion(over: Over) {
  return {
    count: async () => 0,
    findMany: async (a: { where: { status?: unknown; subjectType?: string } }) => {
      if (a.where.subjectType === "feed") {
        return over.feedQuestions ?? [];
      }
      if (a.where.subjectType === "email") {
        return over.interviewQuestions ?? [];
      }
      if (a.where.status === "answered") {
        return over.answered ?? [];
      }
      return [];
    },
    updateMany: async () => ({ count: 0 }),
  };
}

function fakeJob(over: Over) {
  return {
    // Routed by the one filter each read sets: applied = warm-intro pool, matchScore = promote
    // sweep, status `in` = board health, and the rest is the approved gather.
    findMany: async (a: { where: { status?: unknown } }) => {
      if (a.where.status === "applied") {
        return over.recentAppliedJobs ?? [];
      }
      if ("matchScore" in a.where) {
        return over.scoredPendingJobs ?? [];
      }
      if (typeof a.where.status === "object") {
        return over.boardDiagnoseJobs ?? [];
      }
      return over.approvedJobs ?? [];
    },
    updateMany: async () => ({ count: 1 }),
    groupBy: async (a: { by: string[] }) => {
      if (a.by.includes("skipReason")) {
        return over.skipReasonRows ?? [];
      }
      return over.quietJobCounts ?? [];
    },
    count: async (a: { where: { status?: string } }) => {
      if (a.where.status === "failed") {
        return over.jobsFailed ?? 0;
      }
      if (a.where.status === "skipped") {
        return over.jobsSkipped ?? 0;
      }
      return 0;
    },
  };
}

function fakeFeed(over: Over) {
  return {
    // Routed by the field only that read sets.
    findMany: async (a: { where: { kind?: unknown; pausedAt?: unknown; jobs?: unknown } }) => {
      const { kind, pausedAt } = a.where;
      if (pausedAt != null) {
        return over.pausedSearches ?? [];
      }
      if (kind === "search") {
        return over.pilotSearches ?? [];
      }
      if (typeof kind === "object" && kind !== null && "in" in kind) {
        return over.scorePendingFeeds ?? [];
      }
      if ("jobs" in a.where) {
        return over.queuedFeeds ?? [];
      }
      return over.quietFeeds ?? [];
    },
    // A paused-feed check filters on `pausedAt`; the rest count searches.
    count: async (a: { where: { kind?: string; pausedAt?: unknown } }) =>
      a.where.pausedAt != null
        ? (over.pausedFeeds ?? []).filter((kind) => kind === a.where.kind).length
        : (over.pilotSearches ?? []).length,
  };
}

/** A fake Prisma covering every read and write a task list refresh issues. */
function makeTaskListDb(over: Over = {}) {
  const rec: Recorder = {
    settleScored: [],
    journals: [],
    pushes: [],
    inboxSyncs: [],
  };
  // Networking is off by default in prod; these suites exercise it.
  const config = over.config ?? { networking: { email: "review", linkedIn: "draft" } };

  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    pilotState: {
      upsert: async () => ({
        autopilot: true,
        cycleCount: 0,
        config: config,
      }),
      update: async () => ({}),
    },
    pilotRequest: { findMany: async () => over.pendingRequests ?? [] },
    pilotMessage: { findFirst: async () => null },
    pilotRun: fakePilotRun(over),
    profile: { findUnique: async () => over.profile ?? null },
    user: { findUnique: async () => ({ primaryResumeId: over.primaryResumeId ?? null }) },
    resume: { findMany: async () => [], count: async () => over.resumeCount ?? 0 },
    pilotQuestion: fakePilotQuestion(over),
    job: fakeJob(over),
    application: {
      count: async (a: { where: Row }) =>
        over.digestApps != null && a.where.appliedAt ? over.digestApps : (over.appliedToday ?? 0),
      // Only the prep gather filters on `events`.
      findMany: async (a: { where: Row }) =>
        "events" in a.where ? (over.interviewPrepApps ?? []) : (over.interviewReplyApps ?? []),
    },
    feed: fakeFeed(over),
    upworkAccount: { findUnique: async () => over.upworkAccount ?? null },
    upworkProfile: { count: async () => over.upworkProfiles ?? 0 },
    upworkInboxItem: { count: async () => over.upworkUnread ?? 0 },
    networkingMessage: {
      findMany: async () => [],
      groupBy: async () => [],
      count: async (a: { where: Row }) =>
        "repliedAt" in a.where ? (over.networkingReplies ?? 0) : (over.networkingSent ?? 0),
    },
    // Only the job-alert gather filters on `importedAt`; the inbox gather sees no mail.
    emailMessage: {
      findMany: async (a: { where: Row }) =>
        "importedAt" in a.where ? (over.jobAlertEmails ?? []) : [],
      count: async (a: { where: Row }) =>
        "importedAt" in a.where ? (over.jobAlertEmails ?? []).length : 0,
    },
    contact: { findMany: async () => over.contacts ?? [] },
    pilotJournalEntry: {
      // Defaults to 1 so the digest stays quiet elsewhere; counting this run's own digest writes
      // is what lets the race test see a concurrent writer.
      count: async () =>
        (over.existingDigests ?? 1) + rec.journals.filter((j) => j.kind === "digest").length,
    },
    $executeRaw: async () => 0,
    // Serialized, as the advisory lock would, so concurrent digest writes queue up.
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => {
      const run = txChain.then(() => cb(db));
      txChain = run.catch(() => undefined);
      return run;
    },
  };

  return { prisma: db as unknown as PrismaClient, rec };
}

export function makeTaskListDeps(over: Over = {}) {
  const { prisma, rec } = makeTaskListDb(over);
  const jobs = {
    settleScored: async (...args: unknown[]) => {
      rec.settleScored.push(args);
    },
  } as unknown as JobService;
  const journal = {
    append: async (_userId: string, body: { entries: Row[] }) => {
      rec.journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
  const emailSync = {
    syncIfStale: async (userId: string, staleMs: number) => {
      rec.inboxSyncs.push({ userId, staleMs });
    },
  } as unknown as EmailSyncService;
  return { prisma, jobs, journal, push: makePush(rec.pushes), emailSync, rec };
}

export const serviceWithRec = (over: Over = {}) => {
  const { prisma, jobs, journal, push, emailSync, rec } = makeTaskListDeps(over);
  const maintenance = new PilotMaintenanceService(prisma, jobs);
  const digest = new DigestService(prisma, journal, push);
  return { svc: new TaskListService(prisma, maintenance, digest, emailSync), rec };
};

export const service = (over: Over = {}) => serviceWithRec(over).svc;

/** A PilotSearch row, due since the epoch unless overridden. */
export const pilotSearchRow = (over: Row = {}) => ({
  id: "s1",
  query: "react",
  board: { domain: "linkedin.com" },
  resumeId: null,
  lastRunAt: null,
  nextRunAt: new Date(0),
  ...over,
});

export const approvedJob = (over: Row = {}) => ({
  feedId: "c1",
  key: "jobkey",
  title: "Engineer",
  url: "https://x/1",
  board: null,
  brief: null,
  company: "Acme",
  matchScore: 80,
  feed: { config: {} },
  ...over,
});
