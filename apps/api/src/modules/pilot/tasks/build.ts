import {
  channelAutonomy,
  networkingMode,
  type PilotInstructionsConfig,
  type PilotTask,
  type TaskListContent,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { nextDayReset } from "@/common/date/buckets";
import type { TaskJob } from "./gather-jobs";
import type { Followup } from "./gather-outreach";
import type { DueSearch } from "./gather-searches";
import {
  applyTask,
  boardDiagnoseTask,
  discoverTask,
  followupTask,
  inboxTask,
  interviewPrepTask,
  interviewReplyTask,
  jobAlertsTask,
  networkingSendTask,
  promotionDraftTask,
  promotionPostTask,
  questionTask,
  queueScoreTask,
  rescanSkippedTask,
  retryFailedTask,
  reviewPausedTask,
  scorePendingTask,
  setupTask,
  tuneTask,
  upworkSyncTask,
  warmIntroTask,
} from "./make-tasks";

const MAX_TASKS = 10;
const MAX_TITLE_LENGTH = 200;
/** Per-list caps keep one cycle focused; the rest drain over later cycles. */
const PER_TASK_LIST = {
  boardDiagnose: 1,
  reviewPaused: 1,
  interviewReply: 2,
  interviewPrep: 1,
  warmIntro: 1,
  followup: 2,
  promotionDraft: 1,
  campaignReview: 1,
} as const;
const ACTIVE_SLEEP_SECONDS = 15;
/** Floors a tiny `checkIntervalMinutes` so the loop can't spin. */
const MIN_IDLE_SLEEP_SECONDS = 30;
/** A backed-off pilot still wakes within the day. */
const MAX_IDLE_SLEEP_SECONDS = 6 * 60 * 60;
const NEW_JOBS_TARGET_MIN = 5;
const NEW_JOBS_TARGET_MAX = 20;
const SEARCH_MAX_PAGES = 5;

export interface TaskListInput {
  now: Date;
  config: PilotInstructionsConfig;
  // Rotates discovery across the configured boards.
  cycleCount: number;
  openQuestions: number;
  activeRuns: number;
  appliedToday: number;
  networkingSentToday: number;
  // No searches yet, or no goals to derive them from.
  awaitingSetup: boolean;
  // The idle sleep never runs past this or the next harvest slot.
  nextSearchRunAt: Date | null;
  nextJobAlertsAt: Date | null;
  answeredQuestions: TaskPayload<"question.answered">[];
  approvedJobs: TaskJob[];
  warmIntroCandidates: TaskJob[];
  dueQueries: DueSearch[];
  scorePending: TaskPayload<"campaign.scorePending">[];
  queueScores: TaskPayload<"queue.score">[];
  pausedCampaigns: TaskPayload<"campaign.reviewPaused">[];
  boardDiagnose: TaskPayload<"board.diagnose">[];
  inbox: TaskPayload<"inbox.review">;
  // Null when the harvest is off, not due this slot, or has no unharvested mail.
  jobAlerts: Omit<TaskPayload<"inbox.jobAlerts">, "minScore"> | null;
  interviewReplies: TaskPayload<"interview.reply">[];
  interviewPreps: TaskPayload<"interview.prep">[];
  upworkSync: TaskPayload<"upwork.syncInbox"> | null;
  approvedNetworking: TaskPayload<"networking.send">[];
  followups: Followup[];
  approvedPromotions: TaskPayload<"promotion.post">[];
  duePlatforms: TaskPayload<"promotion.draft">[];
  campaignTunes: TaskPayload<"campaign.tune">[];
  rescanSkipped: TaskPayload<"job.rescanSkipped">[];
  retryFailed: TaskPayload<"job.retryFailed">[];
  setup: TaskPayload<"search.setup"> | null;
}

type PipelineWork = Pick<
  TaskListInput,
  "approvedJobs" | "dueQueries" | "scorePending" | "queueScores" | "jobAlerts"
>;

/** Setup and campaign reviews wait until no apply, discovery, harvest or scoring work is queued. */
export function isPipelineQuiet(work: PipelineWork): boolean {
  const { approvedJobs, dueQueries, scorePending, queueScores, jobAlerts } = work;
  const queued = approvedJobs.length + dueQueries.length + scorePending.length + queueScores.length;
  return queued === 0 && jobAlerts === null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Ranks already-gathered work into the task list. Pure, so every gating rule is unit-testable. */
export function buildTaskList(input: TaskListInput): TaskListContent {
  const { now, config } = input;
  const capReached = input.appliedToday >= config.dailyApplyCap;
  const sendsLeft = Math.max(0, config.networking.dailyCap - input.networkingSentToday);
  const outreach = networkingMode(config);
  const emailAutonomy = channelAutonomy(config, "email");

  const tasks: PilotTask[] = [
    ...input.answeredQuestions.map(questionTask),
    ...input.boardDiagnose.slice(0, PER_TASK_LIST.boardDiagnose).map(boardDiagnoseTask),
    ...input.pausedCampaigns.slice(0, PER_TASK_LIST.reviewPaused).map(reviewPausedTask),
    ...input.interviewReplies.slice(0, PER_TASK_LIST.interviewReply).map(interviewReplyTask),
    ...input.interviewPreps.slice(0, PER_TASK_LIST.interviewPrep).map(interviewPrepTask),
    ...input.queueScores.map(queueScoreTask),
    ...input.approvedPromotions.map(promotionPostTask),
    ...input.duePlatforms.slice(0, PER_TASK_LIST.promotionDraft).map(promotionDraftTask),
  ];
  if (!capReached) tasks.push(...input.approvedJobs.map(applyTask));
  if (input.inbox.count > 0) tasks.push(inboxTask(input.inbox));
  // Ungated by the apply cap: harvesting only queues rows, and tomorrow's budget can spend them.
  if (input.jobAlerts) tasks.push(jobAlertsTask({ ...input.jobAlerts, minScore: config.minScore }));
  if (input.upworkSync) tasks.push(upworkSyncTask(input.upworkSync));

  if (outreach && sendsLeft > 0) {
    const intros = input.warmIntroCandidates.slice(0, PER_TASK_LIST.warmIntro);
    tasks.push(...intros.map((job) => warmIntroTask(job, outreach)));
  }
  // Sends and followups act on email threads, and followups only get the budget sends leave over.
  if (emailAutonomy) {
    const sends = input.approvedNetworking.slice(0, sendsLeft);
    const followupRoom = Math.min(PER_TASK_LIST.followup, sendsLeft - sends.length);
    tasks.push(
      ...sends.map(networkingSendTask),
      ...input.followups
        .slice(0, followupRoom)
        .map((followup) =>
          followupTask({ ...followup, channel: "email", autonomy: emailAutonomy }),
        ),
    );
  }

  // Scoring and discovery only matter once nothing approved is left to apply to.
  if (input.approvedJobs.length === 0) {
    const { boards } = config;
    const rotatedBoard = boards.length > 0 ? boards[input.cycleCount % boards.length] : undefined;
    const newJobsTarget = clamp(
      config.dailyApplyCap - input.appliedToday,
      NEW_JOBS_TARGET_MIN,
      NEW_JOBS_TARGET_MAX,
    );
    tasks.push(
      ...input.scorePending.map(scorePendingTask),
      ...input.dueQueries.map((search) =>
        discoverTask({
          ...search,
          board: rotatedBoard ?? search.board,
          minScore: config.minScore,
          newJobsTarget,
          maxPages: SEARCH_MAX_PAGES,
        }),
      ),
    );
  }

  if (isPipelineQuiet(input)) {
    if (input.setup) tasks.push(setupTask(input.setup));
    tasks.push(
      ...input.campaignTunes.slice(0, PER_TASK_LIST.campaignReview).map(tuneTask),
      ...input.rescanSkipped.slice(0, PER_TASK_LIST.campaignReview).map(rescanSkippedTask),
      ...input.retryFailed.slice(0, PER_TASK_LIST.campaignReview).map(retryFailedTask),
    );
  }

  const ranked = tasks
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_TASKS)
    .map((task) => ({ ...task, title: task.title.slice(0, MAX_TITLE_LENGTH) }));

  const secondsUntil = (at: Date | null) =>
    at ? Math.max(0, Math.round((at.getTime() - now.getTime()) / 1000)) : Number.POSITIVE_INFINITY;
  const idleSleep = clamp(
    Math.min(
      config.checkIntervalMinutes * 60,
      secondsUntil(input.nextSearchRunAt),
      secondsUntil(input.nextJobAlertsAt),
    ),
    MIN_IDLE_SLEEP_SECONDS,
    MAX_IDLE_SLEEP_SECONDS,
  );
  const sleepSeconds = ranked.length > 0 ? ACTIVE_SLEEP_SECONDS : idleSleep;

  return {
    builtAt: now,
    tasks: ranked,
    counts: {
      openQuestions: input.openQuestions,
      activeRuns: input.activeRuns,
      approvedJobs: input.approvedJobs.length,
      appliedToday: input.appliedToday,
    },
    budget: {
      dailyApplyCap: config.dailyApplyCap,
      appliedToday: input.appliedToday,
      capReached,
      dailyNetworkingCap: config.networking.dailyCap,
      networkingSentToday: input.networkingSentToday,
      resetsAt: nextDayReset(now),
    },
    emptyReason: emptyReason(ranked.length, capReached, input.awaitingSetup),
    sleepSeconds,
    nextWakeAt: new Date(now.getTime() + sleepSeconds * 1000),
  };
}

/** Named so clients needn't re-derive the gating rules. */
function emptyReason(
  taskCount: number,
  capReached: boolean,
  awaitingSetup: boolean,
): TaskListContent["emptyReason"] {
  if (taskCount > 0) return null;
  if (capReached) return "capReached";
  if (awaitingSetup) return "awaitingSetup";
  return "clear";
}
