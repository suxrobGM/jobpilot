import { makePush, type SentPush } from "@/common/push/push.fake";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import type { PilotJournalService } from "../journal.service";
import type { PilotQuestionService } from "../question.service";
import { TaskListService } from "./task-list.service";

type Row = Record<string, unknown>;

/** A prior run of one task type, as the dampers read it back. */
interface RunRow {
  subjectId: string;
  startedAt: Date;
  finishedAt: Date | null;
  outcome?: string | null;
}

interface Recorder {
  promoteScoredJobs: unknown[][];
  campaignUpdates: { where: Row; data: Row }[];
  journals: Row[];
  pushes: SentPush[];
  inboxSyncs: { userId: string; staleMs: number }[];
}

export interface Over {
  instructionsConfig?: unknown;
  instructionsGoals?: string;
  appliedToday?: number;
  pilotSearches?: Row[];
  answered?: Row[];
  questionRuns?: { subjectId: string }[];
  approvedJobs?: Row[];
  recentAppliedJobs?: Row[];
  contacts?: Row[];
  warmIntroRuns?: RunRow[];
  searchRuns?: RunRow[];
  dueSearchCampaigns?: { campaignId: string; pilotSearchId: string }[];
  scorePendingCampaigns?: Row[];
  scorePendingRuns?: RunRow[];
  scoredPendingJobs?: Row[];
  pausedCampaigns?: Row[];
  campaignQuestions?: { subjectId: string; status: string; answeredAt: Date | null }[];
  pausedReviewRuns?: RunRow[];
  finalizeCampaigns?: Row[];
  queuedCampaigns?: Row[];
  queueScoreRuns?: RunRow[];
  boardDiagnoseJobs?: Row[];
  boardDiagnoseRuns?: RunRow[];
  platformPosts?: { platform: string; createdAt: Date }[];
  interviewReplyApps?: Row[];
  interviewPrepApps?: Row[];
  interviewQuestions?: { subjectId: string }[];
  upworkAccount?: { lastSyncedAt: Date | null } | null;
  upworkProfiles?: number;
  upworkUnread?: number;
  upworkSyncRun?: { startedAt: Date; finishedAt: Date | null; outcome?: string | null } | null;
  quietCampaigns?: Row[];
  quietJobCounts?: Row[];
  actionMarkers?: { subjectId: string | null; detail: unknown }[];
  skipReasonRows?: { campaignId: string; skipReason: string | null; _count: { _all: number } }[];
  setupRun?: { finishedAt: Date | null } | null;
  existingDigests?: number;
  digestApps?: number;
  jobsFailed?: number;
  jobsSkipped?: number;
  networkingSent?: number;
  networkingReplies?: number;
  promotionsPosted?: number;
}

function fakePilotRun(over: Over) {
  const byTaskType: Record<string, RunRow[] | undefined> = {
    "campaign.scorePending": over.scorePendingRuns,
    "queue.score": over.queueScoreRuns,
    "networking.warmIntro": over.warmIntroRuns,
    "campaign.reviewPaused": over.pausedReviewRuns,
    "search.discover": over.searchRuns,
    "board.diagnose": over.boardDiagnoseRuns,
  };
  const latestByTaskType: Record<string, unknown> = {
    "search.setup": over.setupRun,
    "upwork.syncInbox": over.upworkSyncRun,
  };
  return {
    findMany: async (a: { where: { subjectType?: string; taskType?: string } }) => {
      if (a.where.taskType) return byTaskType[a.where.taskType] ?? [];
      if (a.where.subjectType === "question") return over.questionRuns ?? [];
      return [];
    },
    findFirst: async (a: { where: { taskType: string } }) =>
      latestByTaskType[a.where.taskType] ?? null,
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
  };
}

function fakePilotQuestion(over: Over) {
  return {
    count: async () => 0,
    findMany: async (a: { where: { status?: unknown; subjectType?: string } }) => {
      if (a.where.subjectType === "campaign") return over.campaignQuestions ?? [];
      if (a.where.subjectType === "email") return over.interviewQuestions ?? [];
      if (a.where.status === "answered") return over.answered ?? [];
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
      // Crash recovery finds nothing interrupted.
      if (a.where.status === "applying" || a.where.status === "needs_user") return [];
      if (a.where.status === "applied") return over.recentAppliedJobs ?? [];
      if ("matchScore" in a.where) return over.scoredPendingJobs ?? [];
      if (typeof a.where.status === "object") return over.boardDiagnoseJobs ?? [];
      return over.approvedJobs ?? [];
    },
    updateMany: async () => ({ count: 1 }),
    groupBy: async (a: { by: string[] }) => {
      if (a.by.includes("skipReason")) return over.skipReasonRows ?? [];
      return over.quietJobCounts ?? [];
    },
    count: async (a: { where: { status?: string } }) => {
      if (a.where.status === "failed") return over.jobsFailed ?? 0;
      if (a.where.status === "skipped") return over.jobsSkipped ?? 0;
      return 0;
    },
  };
}

function fakeCampaign(over: Over, rec: Recorder) {
  return {
    // Each gather is told apart by a field only it sets. Finalize also filters `jobs`, so its `OR`
    // check has to come before score-pending's.
    findMany: async (a: { where: { status?: string; source?: string } }) => {
      if (a.where.status === "paused") return over.pausedCampaigns ?? [];
      if ("pilotSearchId" in a.where) return over.dueSearchCampaigns ?? [];
      if ("OR" in a.where) return over.finalizeCampaigns ?? [];
      if (a.where.source === "apply") return over.queuedCampaigns ?? [];
      if ("jobs" in a.where) return over.scorePendingCampaigns ?? [];
      return over.quietCampaigns ?? [];
    },
    updateMany: async (a: { where: Row; data: Row }) => {
      rec.campaignUpdates.push(a);
      return { count: 1 };
    },
  };
}

/** A fake Prisma covering every read and write a task list refresh issues. */
function makeTaskListDb(over: Over = {}) {
  const rec: Recorder = {
    promoteScoredJobs: [],
    campaignUpdates: [],
    journals: [],
    pushes: [],
    inboxSyncs: [],
  };
  // Networking is off by default in prod; these suites exercise it.
  const config = over.instructionsConfig ?? { networking: { email: "review", linkedIn: "draft" } };

  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    pilotState: {
      findUnique: async () => ({
        running: true,
        cycleCount: 0,
        instructionsConfig: config,
        instructionsGoals: over.instructionsGoals ?? "",
      }),
      update: async () => ({}),
    },
    pilotSearch: {
      findMany: async () => over.pilotSearches ?? [],
      count: async () => (over.pilotSearches ?? []).length,
    },
    pilotRun: fakePilotRun(over),
    pilotQuestion: fakePilotQuestion(over),
    job: fakeJob(over),
    application: {
      count: async (a: { where: Row }) =>
        over.digestApps != null && a.where.appliedAt ? over.digestApps : (over.appliedToday ?? 0),
      // Only the prep gather filters on `events`.
      findMany: async (a: { where: Row }) =>
        "events" in a.where ? (over.interviewPrepApps ?? []) : (over.interviewReplyApps ?? []),
    },
    campaign: fakeCampaign(over, rec),
    upworkAccount: { findUnique: async () => over.upworkAccount ?? null },
    upworkProfile: { count: async () => over.upworkProfiles ?? 0 },
    upworkInboxItem: { count: async () => over.upworkUnread ?? 0 },
    networkingMessage: {
      findMany: async () => [],
      groupBy: async () => [],
      count: async (a: { where: Row }) =>
        "repliedAt" in a.where ? (over.networkingReplies ?? 0) : (over.networkingSent ?? 0),
    },
    promotionPost: {
      findMany: async () => [],
      groupBy: async () =>
        (over.platformPosts ?? []).map((post) => ({
          platform: post.platform,
          _max: { createdAt: post.createdAt },
        })),
      count: async () => over.promotionsPosted ?? 0,
    },
    emailMessage: { findMany: async () => [], count: async () => 0 },
    contact: { findMany: async () => over.contacts ?? [] },
    pilotJournalEntry: {
      // Defaults to 1 so the digest stays quiet elsewhere; counting this run's own digest writes
      // is what lets the race test see a concurrent writer.
      count: async () =>
        (over.existingDigests ?? 1) + rec.journals.filter((j) => j.kind === "digest").length,
      findMany: async () => over.actionMarkers ?? [],
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
  const campaignJobs = {
    promoteScoredJobs: async (...args: unknown[]) => {
      rec.promoteScoredJobs.push(args);
    },
  } as unknown as CampaignJobService;
  const journal = {
    appendJournal: async (_userId: string, body: { entries: Row[] }) => {
      rec.journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
  const emailSync = {
    syncIfStale: async (userId: string, staleMs: number) => {
      rec.inboxSyncs.push({ userId, staleMs });
    },
  } as unknown as EmailSyncService;
  const questions = { announce: () => [] } as unknown as PilotQuestionService;
  return { prisma, campaignJobs, journal, push: makePush(rec.pushes), emailSync, questions, rec };
}

export const serviceWithRec = (over: Over = {}) => {
  const { prisma, campaignJobs, journal, push, emailSync, questions, rec } = makeTaskListDeps(over);
  return {
    svc: new TaskListService(prisma, campaignJobs, journal, push, emailSync, questions),
    rec,
  };
};

export const service = (over: Over = {}) => serviceWithRec(over).svc;

/** A PilotSearch row, due since the epoch unless overridden. */
export const pilotSearchRow = (over: Row = {}) => ({
  id: "s1",
  query: "react",
  board: null,
  resumeId: null,
  lastRunAt: null,
  nextRunAt: new Date(0),
  ...over,
});

export const approvedJob = (over: Row = {}) => ({
  campaignId: "c1",
  key: "jobkey",
  title: "Engineer",
  url: "https://x/1",
  board: null,
  brief: null,
  company: "Acme",
  matchScore: 80,
  campaign: { config: {} },
  ...over,
});
