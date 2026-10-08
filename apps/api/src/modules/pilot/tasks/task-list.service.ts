import {
  channelAutonomy,
  networkingMode,
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
  type TaskList,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { PushService } from "@/common/push/push.service";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { EmailSyncService } from "@/modules/email/sync/sync.service";
import { PilotJournalService } from "../journal.service";
import { countAppliedToday, countSentToday } from "../pilot.stats";
import { buildTaskList, isPipelineQuiet, type TaskListInput } from "./build";
import { writeDigestIfDue } from "./digest";
import {
  gatherCampaignReviews,
  gatherPausedCampaigns,
  gatherQueueScores,
  gatherScorePending,
} from "./gather-campaigns";
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
import { gatherDueSearches, gatherSetup } from "./gather-searches";
import { finalizeIdleCampaigns, promoteScoredPendingJobs, runExpiry } from "./maintenance";
import { parseTaskListSnapshot } from "./snapshot";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
/** The default check interval: idle cycles always pull mail, busy 15s cycles don't. */
export const INBOX_SYNC_STALE_MS = 30 * 60 * 1000;

type Gathered = Omit<TaskListInput, "now" | "config" | "cycleCount">;

interface GatherContext {
  config: PilotInstructionsConfig;
  goals: string;
  jobAlertsRequestedAt: Date | null;
}

const NO_DUE_SEARCHES: Pick<Gathered, "dueQueries" | "nextSearchRunAt"> = {
  dueQueries: [],
  nextSearchRunAt: null,
};
const NO_REVIEWS: Pick<Gathered, "campaignTunes" | "rescanSkipped" | "retryFailed"> = {
  campaignTunes: [],
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

@singleton()
export class TaskListService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly journal: PilotJournalService,
    private readonly push: PushService,
    private readonly emailSync: EmailSyncService,
  ) {}

  /** The current snapshot, with none of refresh's writes. */
  async getCurrent(userId: string) {
    const state = await this.prisma.pilotState.findUnique({ where: { userId } });
    if (!state?.running) throw conflict("Pilot is stopped.");
    const expiresAt = state.taskListExpiresAt;
    const live = state.taskListSnapshot && expiresAt && expiresAt > new Date();
    return { taskList: live ? parseTaskListSnapshot(state.taskListSnapshot) : null };
  }

  async refresh(userId: string): Promise<TaskList> {
    const state = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: {
        running: true,
        cycleCount: true,
        instructionsConfig: true,
        instructionsGoals: true,
        jobAlertsRequestedAt: true,
      },
    });
    if (!state?.running) throw conflict("Pilot is stopped.");

    const now = new Date();
    const config = pilotInstructionsConfigSchema.parse(state.instructionsConfig);

    // Mail first so inbox.review sees it; promotion before finalize so fresh approvals keep a
    // campaign open.
    await this.emailSync.syncIfStale(userId, INBOX_SYNC_STALE_MS, now);
    await runExpiry(this.prisma, userId, now);
    await promoteScoredPendingJobs(this.prisma, this.campaignJobs, userId, config.minScore);
    await finalizeIdleCampaigns(this.prisma, this.journal, userId, now);

    const gathered = await this.gather(
      userId,
      {
        config,
        goals: state.instructionsGoals.trim(),
        jobAlertsRequestedAt: state.jobAlertsRequestedAt,
      },
      now,
    );
    const deps = { prisma: this.prisma, journal: this.journal, push: this.push };
    void writeDigestIfDue(deps, userId, now, gathered.openQuestions);

    const taskList: TaskList = {
      ...buildTaskList({ ...gathered, now, config, cycleCount: state.cycleCount }),
      version: crypto.randomUUID(),
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    };
    await this.prisma.pilotState.update({
      where: { userId },
      data: {
        taskListVersion: taskList.version,
        taskListBuiltAt: taskList.builtAt,
        taskListExpiresAt: taskList.expiresAt,
        taskListSnapshot: toInputJson(taskList),
      },
    });
    return taskList;
  }

  private async gather(userId: string, context: GatherContext, now: Date): Promise<Gathered> {
    const { config, goals } = context;
    const { prisma } = this;
    // Off channels skip their reads entirely; sends and followups only ever act on email.
    const emailOn = channelAutonomy(config, "email") !== null;
    const outreachOn = networkingMode(config) !== null;

    const { searchCount, harvest, ...gatheredBase } = await allNamed({
      openQuestions: prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
      activeRuns: prisma.pilotRun.count({
        where: { userId, finishedAt: null, expiresAt: { gt: now } },
      }),
      searchCount: prisma.pilotSearch.count({ where: { userId } }),
      appliedToday: countAppliedToday(prisma, userId, now),
      networkingSentToday: outreachOn ? countSentToday(prisma, userId, now) : 0,
      answeredQuestions: gatherAnsweredQuestions(prisma, userId),
      approvedJobs: gatherApprovedJobs(prisma, userId),
      queueScores: gatherQueueScores(prisma, userId, config.minScore, now),
      pausedCampaigns: gatherPausedCampaigns(prisma, userId, now),
      boardDiagnose: gatherBoardDiagnoses(prisma, userId, now),
      inbox: gatherInbox(prisma, userId),
      harvest: gatherJobAlerts(prisma, userId, config.jobAlerts, context.jobAlertsRequestedAt, now),
      interviewReplies: gatherInterviewReplies(prisma, userId),
      interviewPreps: gatherInterviewPreps(prisma, userId),
      upworkSync: gatherUpworkSync(prisma, userId, now),
      approvedNetworking: emailOn ? gatherApprovedNetworking(prisma, userId) : [],
      followups: emailOn ? gatherFollowups(prisma, userId, config, now) : [],
      approvedPromotions: gatherApprovedPromotions(prisma, userId, now),
      duePlatforms: gatherDuePlatforms(prisma, userId, config, now),
    });

    const base = { ...gatheredBase, ...harvest };
    const canSend = base.networkingSentToday < config.networking.dailyCap;
    const hungry = base.appliedToday < config.dailyApplyCap;
    // Scoring and discovery only matter once nothing approved is left to apply to.
    const drained = base.approvedJobs.length === 0;
    const [warmIntroCandidates, searches, scorePending] = await Promise.all([
      outreachOn && canSend
        ? gatherWarmIntroCandidates(prisma, userId, now, base.approvedJobs)
        : [],
      drained ? gatherDueSearches(prisma, userId, now, hungry) : NO_DUE_SEARCHES,
      drained ? gatherScorePending(prisma, userId, config.minScore, now) : [],
    ]);
    // A job can sit in both lists; the Set keeps one contacts pass per job.
    await attachWarmContacts(prisma, userId, [
      ...new Set([...base.approvedJobs, ...warmIntroCandidates]),
    ]);

    const quiet = isPipelineQuiet({ ...base, ...searches, scorePending });
    // Blank goals need no task: emptyReason "awaitingSetup" already says so.
    const canSetUp = quiet && goals !== "" && (searchCount === 0 || hungry);
    const [reviews, setup] = await Promise.all([
      quiet ? gatherCampaignReviews(prisma, userId, now) : NO_REVIEWS,
      canSetUp ? gatherSetup(prisma, userId, { goals, minScore: config.minScore }, now) : null,
    ]);

    return {
      ...base,
      ...searches,
      ...reviews,
      warmIntroCandidates,
      scorePending,
      setup,
      awaitingSetup: searchCount === 0 || goals === "",
    };
  }
}
