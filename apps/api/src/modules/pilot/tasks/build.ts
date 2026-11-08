import type { NetworkingMode } from "@jobpilot/contracts/networking";
import {
  nextDailyRun,
  type PilotConfig,
  type PilotTask,
  type TaskListContent,
  type TaskPayload,
} from "@jobpilot/contracts/pilot";
import { nextDayReset } from "@/common/date/buckets";
import { type AllowedToday, allowedToday } from "./allowed-today";
import type { FeedReviews } from "./gather/feed-reviews";
import type { TaskJob } from "./gather/jobs";
import type { Followup } from "./gather/outreach";
import type { ResearchTask } from "./gather/research";
import type { DueSearch } from "./gather/searches";
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
export const SEARCH_MAX_PAGES = 5;
/** Enough to lift a cap-exempt job over an equal or slightly better match, not a much better one. */
const CAP_EXEMPT_BOOST = 10;

/** Read whether or not autopilot is on. */
export interface TaskCounts {
  openQuestions: number;
  activeRuns: number;
  appliedToday: number;
  networkingSentToday: number;
  answeredQuestions: TaskPayload<"question.answered">[];
  approvedJobs: TaskJob[];
}

/** Everything only autonomous work reads, empty while autopilot is off. */
export interface AutonomousWork extends FeedReviews {
  // The idle sleep never runs past this or the next job-alert slot.
  nextSearchRunAt: Date | null;
  warmIntroCandidates: TaskJob[];
  dueQueries: DueSearch[];
  scorePending: TaskPayload<"feed.score">[];
  queueScores: TaskPayload<"queue.score">[];
  pausedFeeds: TaskPayload<"search.review">[];
  boardDiagnoses: TaskPayload<"board.diagnose">[];
  inbox: TaskPayload<"inbox.review">;
  jobAlerts: TaskPayload<"inbox.jobAlerts"> | null;
  interviewReplies: TaskPayload<"interview.reply">[];
  interviewPreps: TaskPayload<"interview.prep">[];
  upworkSync: TaskPayload<"upwork.syncInbox"> | null;
  approvedNetworking: TaskPayload<"networking.send">[];
  followups: Followup[];
  setup: TaskPayload<"search.setup"> | null;
  research: ResearchTask | null;
}

export interface TaskListInput extends TaskCounts, AutonomousWork {
  now: Date;
  config: PilotConfig;
  // Off: only what the user asked for runs.
  autopilot: boolean;
  requests: PilotTask[];
  chat: PilotTask | null;
  // Rotates discovery across the configured boards.
  cycleCount: number;
  // No searches yet, or no goals to derive them from.
  awaitingSetup: boolean;
}

type PipelineWork = Pick<
  TaskListInput,
  "approvedJobs" | "dueQueries" | "scorePending" | "queueScores" | "jobAlerts"
>;

/** Setup and feed reviews wait until no apply, discovery, import or scoring work is queued. */
export function isPipelineQuiet(work: PipelineWork): boolean {
  const { approvedJobs, dueQueries, scorePending, queueScores, jobAlerts } = work;
  const queued = approvedJobs.length + dueQueries.length + scorePending.length + queueScores.length;
  return queued === 0 && jobAlerts === null;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function applyTask(job: TaskJob, preferCapExempt: boolean): PilotTask {
  const payload = {
    feedId: job.feedId,
    jobKey: job.key,
    jobTitle: job.title,
    url: job.url,
    board: job.board,
    brief: job.brief,
    resumeId: job.resumeId,
    matchScore: job.matchScore,
    warmContacts: job.warmContacts,
  };
  const capExemptBoost = preferCapExempt && job.capExemptBasis ? CAP_EXEMPT_BOOST : 0;
  return makeTask("job.apply", payload, (job.matchScore ?? 0) + capExemptBoost);
}

/** An empty contact list still earns the task: finding a first contact is the point. */
function warmIntroPayload(job: TaskJob, mode: NetworkingMode): TaskPayload<"networking.warmIntro"> {
  return {
    feedId: job.feedId,
    jobKey: job.key,
    company: job.company,
    jobTitle: job.title,
    jobUrl: job.url,
    contacts: job.warmContacts ?? [],
    ...mode,
  };
}

/** Highest priority wins when a request and the pilot's own pick name the same task. */
function dedupeById(tasks: PilotTask[]): PilotTask[] {
  const best = new Map<string, PilotTask>();
  for (const task of tasks) {
    const current = best.get(task.id);
    if (!current || task.priority > current.priority) {
      best.set(task.id, task);
    }
  }
  return [...best.values()];
}

/** Ranks already-gathered work into the task list. Pure, so every gating rule is unit-testable. */
export function buildTaskList(input: TaskListInput): TaskListContent {
  const allowed = allowedToday(input.config, input);
  // The user's own asks run with autopilot off too.
  const tasks = [...input.requests, ...makeTasks("question.answered", input.answeredQuestions)];
  if (input.chat) {
    tasks.push(input.chat);
  }
  if (input.autopilot) {
    tasks.push(...autonomousTasks(input, allowed));
  }
  return finishTaskList(input, dedupeById(tasks), allowed.appliesLeft === 0);
}

/** Everything the pilot picks on its own; runs only with autopilot on. */
function autonomousTasks(input: TaskListInput, allowed: AllowedToday): PilotTask[] {
  const tasks: PilotTask[] = [
    ...makeTasks("board.diagnose", input.boardDiagnoses),
    ...makeTasks("search.review", input.pausedFeeds),
    ...makeTasks("interview.reply", input.interviewReplies),
    ...makeTasks("interview.prep", input.interviewPreps),
    ...makeTasks("queue.score", input.queueScores),
  ];
  if (allowed.appliesLeft > 0) {
    const { preferCapExempt } = input.config;
    tasks.push(...input.approvedJobs.map((job) => applyTask(job, preferCapExempt)));
  }
  if (input.inbox.count > 0) {
    tasks.push(makeTask("inbox.review", input.inbox));
  }
  // Ungated by the apply cap: importing only queues rows for later applies.
  if (input.jobAlerts) {
    tasks.push(makeTask("inbox.jobAlerts", input.jobAlerts));
  }
  if (input.upworkSync) {
    tasks.push(makeTask("upwork.syncInbox", input.upworkSync));
  }
  tasks.push(...outreachTasks(input, allowed));

  const newJobsTarget = clamp(allowed.appliesLeft, NEW_JOBS_TARGET_MIN, NEW_JOBS_TARGET_MAX);
  // Scoring and discovery only matter once nothing approved is left to apply to.
  if (input.approvedJobs.length === 0) {
    tasks.push(...discoveryTasks(input, newJobsTarget));
  }

  if (isPipelineQuiet(input)) {
    // A requested research run comes in through `requests`, past this gate.
    if (input.research) {
      tasks.push(makeTask("research.explore", { ...input.research, newJobsTarget }));
    }
    if (input.setup) {
      tasks.push(makeTask("search.setup", input.setup));
    }
    tasks.push(
      ...makeTasks("search.tune", input.feedTunes),
      ...makeTasks("job.rescanSkipped", input.rescanSkipped),
      ...makeTasks("job.retryFailed", input.retryFailed),
    );
  }
  return tasks;
}

function outreachTasks(input: TaskListInput, allowed: AllowedToday): PilotTask[] {
  const { emailAutonomy, outreach, sendsLeft } = allowed;
  const tasks: PilotTask[] = [];
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
  return tasks;
}

/** A search pinned to a board stays there; the rest rotate the configured boards per cycle. */
export function discoveryBoard(boards: string[], cycleCount: number, ownBoard: string | undefined) {
  if (ownBoard || boards.length === 0) {
    return ownBoard;
  }
  return boards[cycleCount % boards.length];
}

function discoveryTasks(input: TaskListInput, newJobsTarget: number): PilotTask[] {
  const { boards, minScore } = input.config;
  const discoveries = input.dueQueries.map((search) => ({
    ...search,
    board: discoveryBoard(boards, input.cycleCount, search.board),
    minScore,
    newJobsTarget,
    maxPages: SEARCH_MAX_PAGES,
  }));
  return [
    ...makeTasks("feed.score", input.scorePending),
    ...makeTasks("search.discover", discoveries),
  ];
}

/** Sleeps until the next check, search or job-alert slot, whichever is first, within bounds. */
function idleSleepSeconds(input: TaskListInput): number {
  const { now, config } = input;
  const { jobAlerts } = config;
  const nextJobAlertsAt = jobAlerts.enabled
    ? nextDailyRun(jobAlerts.runHours, jobAlerts.timeZone, now)
    : null;
  const secondsUntil = (at: Date | null) =>
    at ? Math.max(0, Math.round((at.getTime() - now.getTime()) / 1000)) : Number.POSITIVE_INFINITY;
  const soonest = Math.min(
    config.checkIntervalMinutes * 60,
    secondsUntil(input.nextSearchRunAt),
    secondsUntil(nextJobAlertsAt),
  );
  return clamp(soonest, MIN_IDLE_SLEEP_SECONDS, MAX_IDLE_SLEEP_SECONDS);
}

function finishTaskList(
  input: TaskListInput,
  tasks: PilotTask[],
  capReached: boolean,
): TaskListContent {
  const { now, config } = input;
  const ranked = tasks
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_TASKS)
    .map((task) => ({ ...task, title: task.title.slice(0, MAX_TITLE_LENGTH) }));
  const sleepSeconds = ranked.length > 0 ? ACTIVE_SLEEP_SECONDS : idleSleepSeconds(input);

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
    emptyReason: emptyReason(ranked.length, capReached, input.awaitingSetup, input.autopilot),
    sleepSeconds,
    nextWakeAt: new Date(now.getTime() + sleepSeconds * 1000),
  };
}

/** Named so clients needn't re-derive the gating rules. */
function emptyReason(
  taskCount: number,
  capReached: boolean,
  awaitingSetup: boolean,
  autopilot: boolean,
): TaskListContent["emptyReason"] {
  if (taskCount > 0) {
    return null;
  }
  if (!autopilot) {
    return "autopilotOff";
  }
  if (capReached) {
    return "capReached";
  }
  if (awaitingSetup) {
    return "awaitingSetup";
  }
  return "clear";
}
