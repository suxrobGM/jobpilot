import type { NetworkingMode } from "@jobpilot/contracts/networking";
import {
  nextDailyRun,
  type PilotInstructionsConfig,
  type PilotTask,
  type TaskListContent,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { nextDayReset } from "@/common/date/buckets";
import { allowedToday } from "./allowed-today";
import type { TaskJob } from "./gather-jobs";
import type { Followup } from "./gather-outreach";
import type { DueSearch } from "./gather-searches";
import { makeTask, makeTasks, TASK_DEFS } from "./task-defs";

const MAX_TASKS = 10;
const MAX_TITLE_LENGTH = 200;
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
  // The idle sleep never runs past this or the next job-alert slot.
  nextSearchRunAt: Date | null;
  answeredQuestions: TaskPayload<"question.answered">[];
  approvedJobs: TaskJob[];
  warmIntroCandidates: TaskJob[];
  dueQueries: DueSearch[];
  scorePending: TaskPayload<"campaign.scorePending">[];
  queueScores: TaskPayload<"queue.score">[];
  pausedCampaigns: TaskPayload<"campaign.reviewPaused">[];
  boardDiagnoses: TaskPayload<"board.diagnose">[];
  inbox: TaskPayload<"inbox.review">;
  jobAlerts: TaskPayload<"inbox.jobAlerts"> | null;
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

/** Setup and campaign reviews wait until no apply, discovery, import or scoring work is queued. */
export function isPipelineQuiet(work: PipelineWork): boolean {
  const { approvedJobs, dueQueries, scorePending, queueScores, jobAlerts } = work;
  const queued = approvedJobs.length + dueQueries.length + scorePending.length + queueScores.length;
  return queued === 0 && jobAlerts === null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function applyTask(job: TaskJob): PilotTask {
  const payload = {
    campaignId: job.campaignId,
    jobKey: job.key,
    jobTitle: job.title,
    url: job.url,
    board: job.board,
    brief: job.brief,
    resumeId: job.resumeId,
    matchScore: job.matchScore,
    warmContacts: job.warmContacts,
  };
  return makeTask("job.apply", payload, job.matchScore ?? 0);
}

/** An empty contact list still earns the task: finding a first contact is the point. */
function warmIntroPayload(job: TaskJob, mode: NetworkingMode): TaskPayload<"networking.warmIntro"> {
  return {
    campaignId: job.campaignId,
    jobKey: job.key,
    company: job.company,
    jobTitle: job.title,
    jobUrl: job.url,
    contacts: job.warmContacts ?? [],
    ...mode,
  };
}

/** Ranks already-gathered work into the task list. Pure, so every gating rule is unit-testable. */
export function buildTaskList(input: TaskListInput): TaskListContent {
  const { now, config } = input;
  const { emailAutonomy, outreach, appliesLeft, sendsLeft } = allowedToday(config, input);
  const capReached = appliesLeft === 0;

  const tasks: PilotTask[] = [
    ...makeTasks("question.answered", input.answeredQuestions),
    ...makeTasks("board.diagnose", input.boardDiagnoses),
    ...makeTasks("campaign.reviewPaused", input.pausedCampaigns),
    ...makeTasks("interview.reply", input.interviewReplies),
    ...makeTasks("interview.prep", input.interviewPreps),
    ...makeTasks("queue.score", input.queueScores),
    ...makeTasks("promotion.post", input.approvedPromotions),
    ...makeTasks("promotion.draft", input.duePlatforms),
  ];
  if (!capReached) tasks.push(...input.approvedJobs.map(applyTask));
  if (input.inbox.count > 0) tasks.push(makeTask("inbox.review", input.inbox));
  // Ungated by the apply cap: importing only queues rows for later applies.
  if (input.jobAlerts) tasks.push(makeTask("inbox.jobAlerts", input.jobAlerts));
  if (input.upworkSync) tasks.push(makeTask("upwork.syncInbox", input.upworkSync));

  if (outreach && sendsLeft > 0) {
    const intros = input.warmIntroCandidates.map((job) => warmIntroPayload(job, outreach));
    tasks.push(...makeTasks("networking.warmIntro", intros));
  }
  // Sends and followups act on email threads, and followups only get the budget sends leave over.
  if (emailAutonomy) {
    const sends = input.approvedNetworking.slice(0, sendsLeft);
    const followupCap = TASK_DEFS["networking.followup"].perList ?? 0;
    const followups = input.followups
      .slice(0, Math.min(followupCap, sendsLeft - sends.length))
      .map((followup) => ({ ...followup, channel: "email" as const, autonomy: emailAutonomy }));
    tasks.push(
      ...makeTasks("networking.send", sends),
      ...makeTasks("networking.followup", followups),
    );
  }

  // Scoring and discovery only matter once nothing approved is left to apply to.
  if (input.approvedJobs.length === 0) {
    const { boards } = config;
    const rotatedBoard = boards.length > 0 ? boards[input.cycleCount % boards.length] : undefined;
    const newJobsTarget = clamp(appliesLeft, NEW_JOBS_TARGET_MIN, NEW_JOBS_TARGET_MAX);
    const discoveries = input.dueQueries.map((search) => ({
      ...search,
      board: rotatedBoard ?? search.board,
      minScore: config.minScore,
      newJobsTarget,
      maxPages: SEARCH_MAX_PAGES,
    }));
    tasks.push(
      ...makeTasks("campaign.scorePending", input.scorePending),
      ...makeTasks("search.discover", discoveries),
    );
  }

  if (isPipelineQuiet(input)) {
    if (input.setup) tasks.push(makeTask("search.setup", input.setup));
    tasks.push(
      ...makeTasks("campaign.tune", input.campaignTunes),
      ...makeTasks("job.rescanSkipped", input.rescanSkipped),
      ...makeTasks("job.retryFailed", input.retryFailed),
    );
  }

  const ranked = tasks
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_TASKS)
    .map((task) => ({ ...task, title: task.title.slice(0, MAX_TITLE_LENGTH) }));

  const { jobAlerts } = config;
  const nextJobAlertsAt = jobAlerts.enabled
    ? nextDailyRun(jobAlerts.runHours, jobAlerts.timeZone, now)
    : null;
  const secondsUntil = (at: Date | null) =>
    at ? Math.max(0, Math.round((at.getTime() - now.getTime()) / 1000)) : Number.POSITIVE_INFINITY;
  const idleSleep = clamp(
    Math.min(
      config.checkIntervalMinutes * 60,
      secondsUntil(input.nextSearchRunAt),
      secondsUntil(nextJobAlertsAt),
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
