import { type PilotConfig, pilotConfigSchema, type TaskList } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { toInputJson } from "@/common/json";
import { PrismaClient } from "@/generated/prisma/client";
import { EmailSyncService } from "@/modules/email/sync/sync.service";
import { JobService } from "@/modules/feed/jobs/job.service";
import { WebPushService } from "@/modules/web-push/web-push.service";
import { PilotJournalService } from "../journal.service";
import { countAppliedToday, countSentToday } from "../pilot.stats";
import { allowedToday } from "./allowed-today";
import { buildTaskList, isPipelineQuiet, type TaskListInput } from "./build";
import { writeDigestIfDue } from "./digest";
import {
  gatherFeedReviews,
  gatherPausedFeeds,
  gatherQueueScores,
  gatherScorePending,
} from "./gather-feeds";
import {
  gatherAnsweredQuestions,
  gatherInbox,
  gatherInterviewPreps,
  gatherInterviewReplies,
  gatherJobAlerts,
  gatherUpworkSync,
} from "./gather-inbox";
import {
  attachWarmContacts,
  gatherApprovedJobs,
  gatherBoardDiagnoses,
  gatherWarmIntroCandidates,
} from "./gather-jobs";
import {
  gatherApprovedNetworking,
  gatherApprovedPromotions,
  gatherDuePlatforms,
  gatherFollowups,
} from "./gather-outreach";
import { gatherChat, gatherRequests } from "./gather-requests";
import { gatherResearch } from "./gather-research";
import { gatherDueSearches, gatherSetup } from "./gather-searches";
import { promoteScoredPendingJobs, runExpiry } from "./maintenance";
import { parseTaskListSnapshot } from "./snapshot";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
/** The default check interval: idle cycles always pull mail, busy 15s cycles don't. */
export const INBOX_SYNC_STALE_MS = 30 * 60 * 1000;

type Gathered = Omit<
  TaskListInput,
  "now" | "config" | "cycleCount" | "autopilot" | "requests" | "chat"
>;

interface GatherContext {
  config: PilotConfig;
  goals: string;
}

const NO_DUE_SEARCHES: Pick<Gathered, "dueQueries" | "nextSearchRunAt"> = {
  dueQueries: [],
  nextSearchRunAt: null,
};
const NO_REVIEWS: Pick<Gathered, "feedTunes" | "rescanSkipped" | "retryFailed"> = {
  feedTunes: [],
  rescanSkipped: [],
  retryFailed: [],
};

/** `Promise.all` over named promises, so a long parallel read can't misalign its results. */
async function allNamed<T extends Record<string, unknown>>(
  named: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const values = await Promise.all(Object.values(named));
  const keys = Object.keys(named);
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as {
    [K in keyof T]: Awaited<T[K]>;
  };
}

@injectable()
export class TaskListService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly jobs = inject(JobService),
    private readonly journal = inject(PilotJournalService),
    private readonly push = inject(WebPushService),
    private readonly emailSync = inject(EmailSyncService),
  ) {}

  /** The current snapshot, with none of refresh's writes. */
  async getCurrent(userId: string) {
    const state = await this.prisma.pilotState.findUnique({ where: { userId } });
    const expiresAt = state?.taskListExpiresAt;
    const snapshot = state?.taskListSnapshot;
    const live = snapshot && expiresAt && expiresAt > new Date();
    return { taskList: live ? parseTaskListSnapshot(snapshot) : null };
  }

  /** Runs whether or not autopilot is on: requests, chat and answered questions always run. */
  async refresh(userId: string): Promise<TaskList> {
    const state = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        autopilot: true,
        cycleCount: true,
        config: true,
        goals: true,
      },
    });

    const now = new Date();
    const config = pilotConfigSchema.parse(state.config);

    // Mail first so inbox.review sees it; promotion before finalize so fresh approvals keep a
    // feed open.
    await this.emailSync.syncIfStale(userId, INBOX_SYNC_STALE_MS, now);
    await runExpiry(this.prisma, userId, now);
    await promoteScoredPendingJobs(this.prisma, this.jobs, userId, config.minScore);
    const goals = state.goals.trim();

    const gathered = await this.gather(userId, { config, goals }, now);
    const [requests, chat] = await Promise.all([
      gatherRequests(this.prisma, userId, { config, goals }, now),
      gatherChat(this.prisma, userId),
    ]);
    const deps = { prisma: this.prisma, journal: this.journal, push: this.push };
    void writeDigestIfDue(deps, userId, now, gathered.openQuestions);

    const taskList: TaskList = {
      ...buildTaskList({
        ...gathered,
        now,
        config,
        cycleCount: state.cycleCount,
        autopilot: state.autopilot,
        requests,
        chat,
      }),
      version: crypto.randomUUID(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    };
    await this.prisma.pilotState.update({
      where: { userId },
      data: {
        taskListVersion: taskList.version,
        taskListExpiresAt: taskList.expiresAt,
        taskListSnapshot: toInputJson(taskList),
      },
    });
    return taskList;
  }

  private async gather(userId: string, context: GatherContext, now: Date): Promise<Gathered> {
    const { config, goals } = context;
    const { prisma } = this;
    const { searchCount, ...base } = await allNamed({
      openQuestions: prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
      activeRuns: prisma.pilotRun.count({
        where: { userId, finishedAt: null, expiresAt: { gt: now } },
      }),
      searchCount: prisma.feed.count({ where: { userId, kind: "search", archivedAt: null } }),
      appliedToday: countAppliedToday(prisma, userId, now),
      networkingSentToday: countSentToday(prisma, userId, now),
      answeredQuestions: gatherAnsweredQuestions(prisma, userId),
      approvedJobs: gatherApprovedJobs(prisma, userId),
      queueScores: gatherQueueScores(prisma, userId, config.minScore, now),
      pausedFeeds: gatherPausedFeeds(prisma, userId, now),
      boardDiagnoses: gatherBoardDiagnoses(prisma, userId, now),
      inbox: gatherInbox(prisma, userId),
      jobAlerts: gatherJobAlerts(prisma, userId, config, now),
      interviewReplies: gatherInterviewReplies(prisma, userId),
      interviewPreps: gatherInterviewPreps(prisma, userId),
      upworkSync: gatherUpworkSync(prisma, userId, now),
      approvedPromotions: gatherApprovedPromotions(prisma, userId, now),
      duePlatforms: gatherDuePlatforms(prisma, userId, config, now),
    });

    // Work today's config or counts rule out skips its reads entirely.
    const { emailAutonomy, outreach, appliesLeft, sendsLeft } = allowedToday(config, base);
    const canApplyMore = appliesLeft > 0;
    // Scoring and discovery only matter once nothing approved is left to apply to.
    const nothingApproved = base.approvedJobs.length === 0;
    const emailOn = emailAutonomy !== null && sendsLeft > 0;
    const [approvedNetworking, followups, warmIntroCandidates, searches, scorePending] =
      await Promise.all([
        emailOn ? gatherApprovedNetworking(prisma, userId) : [],
        emailOn ? gatherFollowups(prisma, userId, config, now) : [],
        outreach && sendsLeft > 0
          ? gatherWarmIntroCandidates(prisma, userId, now, base.approvedJobs)
          : [],
        nothingApproved ? gatherDueSearches(prisma, userId, now, canApplyMore) : NO_DUE_SEARCHES,
        nothingApproved ? gatherScorePending(prisma, userId, config.minScore, now) : [],
      ]);
    // A job can sit in both lists; the Set keeps one contacts pass per job.
    await attachWarmContacts(prisma, userId, [
      ...new Set([...base.approvedJobs, ...warmIntroCandidates]),
    ]);

    const quiet = isPipelineQuiet({ ...base, ...searches, scorePending });
    // Blank goals need no task: emptyReason "awaitingSetup" already says so.
    const canSetUp = quiet && goals !== "" && (searchCount === 0 || canApplyMore);
    const [reviews, setup, research] = await Promise.all([
      quiet ? gatherFeedReviews(prisma, userId, now) : NO_REVIEWS,
      canSetUp ? gatherSetup(prisma, userId, { goals, minScore: config.minScore }, now) : null,
      goals !== "" && quiet
        ? gatherResearch(prisma, userId, { goals, config, searchCount }, now)
        : null,
    ]);

    return {
      ...base,
      ...searches,
      ...reviews,
      approvedNetworking,
      followups,
      warmIntroCandidates,
      scorePending,
      setup,
      research,
      preferCapExempt: config.preferCapExempt,
      awaitingSetup: searchCount === 0 || goals === "",
    };
  }
}
