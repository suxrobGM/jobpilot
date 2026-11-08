import {
  type PilotTask,
  TASK_SUBJECT_TYPES,
  type TaskPayload,
  type TaskType,
} from "@jobpilot/contracts/pilot";
import { jobSubjectId, toJobRef } from "../job-subject";

const CHAT_PRIORITY = 1100;
/** Above answered questions (1000): the user asked for this by name. */
export const REQUEST_PRIORITY = 1050;

interface TaskDef<K extends TaskType> {
  /** Higher runs first; `job.apply` adds its matchScore, so a perfect match reaches 900. */
  priority: number;
  subjectId: (payload: TaskPayload<K>) => string;
  title: (payload: TaskPayload<K>) => string;
  /** At most this many per task list; the rest drain over later cycles. */
  perList?: number;
}

/** One entry per task type: a new type fails typecheck until it has its priority and title. */
export const TASK_DEFS: { [K in TaskType]: TaskDef<K> } = {
  // The user is waiting on a reply, so chat outranks everything.
  "chat.reply": {
    priority: CHAT_PRIORITY,
    subjectId: (p) => p.messageId,
    title: () => "Reply to your message",
  },
  "resume.extract": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.resumeId,
    title: () => "Read your resume",
  },
  "resume.tailor": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.requestId,
    title: () => "Tailor a resume to a job",
  },
  "networking.find": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.requestId,
    title: (p) => `Find contacts: ${p.criteria}`,
  },
  "networking.rewrite": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.requestId,
    title: (p) => `Rewrite ${p.messageIds.length} outreach draft(s)`,
  },
  "upwork.profile": {
    priority: REQUEST_PRIORITY,
    subjectId: () => "profile",
    title: (p) =>
      p.mode === "apply" ? "Improve your Upwork profile" : "Review your Upwork profile",
  },
  "upwork.proposal": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.proposalId,
    title: () => "Write an Upwork proposal",
  },
  "upwork.submit": {
    priority: REQUEST_PRIORITY,
    subjectId: (p) => p.proposalId,
    title: () => "Submit an Upwork proposal",
  },
  "question.answered": {
    priority: 1000,
    subjectId: (p) => p.questionId,
    title: (p) => `Apply answer: ${p.prompt}`,
  },
  "interview.reply": {
    priority: 950,
    subjectId: (p) => p.emailMessageId,
    title: (p) => `Reply to interview invite: ${p.company}`,
    perList: 2,
  },
  // Above any apply: probe a failing board before more attempts pile onto it.
  "board.diagnose": {
    priority: 920,
    subjectId: (p) => p.boardId,
    title: (p) => `Board failing: ${p.board} (${p.consecutiveFailures})`,
    perList: 1,
  },
  // Above any apply, or a list full of applies would starve a stranded feed out of the top 10.
  "search.review": {
    priority: 910,
    subjectId: (p) => p.feedId,
    title: (p) => `Review a paused search: ${p.query}`,
    perList: 1,
  },
  "job.apply": {
    priority: 800,
    subjectId: (p) => jobSubjectId(toJobRef(p)),
    title: (p) => p.jobTitle,
  },
  "interview.prep": {
    priority: 750,
    subjectId: (p) => p.applicationId,
    title: (p) => `Interview prep: ${p.jobTitle}`,
    perList: 1,
  },
  "queue.score": {
    priority: 720,
    subjectId: (p) => p.feedId,
    title: (p) => `Score ${p.queuedCount} pasted link(s)`,
  },
  "networking.send": {
    priority: 700,
    subjectId: (p) => p.messageId,
    title: (p) => `Send networking message: ${p.contactName}`,
  },
  "inbox.review": {
    priority: 650,
    subjectId: () => "inbox",
    title: (p) => `Review ${p.count} inbox message(s)`,
  },
  "upwork.syncInbox": {
    priority: 640,
    subjectId: () => "inbox",
    title: (p) => (p.lastSyncedAt ? "Refresh the Upwork inbox" : "Pull the Upwork inbox"),
  },
  "networking.warmIntro": {
    priority: 550,
    subjectId: (p) => jobSubjectId(toJobRef(p)),
    title: (p) => `Warm intro: ${p.jobTitle}`,
    perList: 1,
  },
  "search.setup": {
    priority: 520,
    subjectId: () => "setup",
    title: () => "Set up searches from your goals",
  },
  // Finish scoring what was found before discovering more.
  "feed.score": {
    priority: 510,
    subjectId: (p) => p.feedId,
    title: (p) => `Score discovered jobs: ${p.query}`,
  },
  // Alert links are pre-filtered by the board, so import them before discovering more.
  "inbox.jobAlerts": {
    priority: 505,
    subjectId: () => "jobAlerts",
    title: (p) => `Import jobs from ${p.count} alert email(s)`,
  },
  "search.discover": {
    priority: 500,
    subjectId: (p) => p.searchId,
    title: (p) => `Discover: ${p.query}`,
  },
  "research.explore": {
    priority: 450,
    subjectId: () => "research",
    title: (p) => (p.focus ? `Web search: ${p.focus}` : "Web search beyond your boards"),
  },
  "networking.followup": {
    priority: 400,
    subjectId: (p) => p.messageId,
    title: (p) => `Follow up: ${p.contactName}`,
    perList: 2,
  },
  "search.tune": {
    priority: 350,
    subjectId: (p) => p.feedId,
    title: (p) => `Tune a search: ${p.query}`,
    perList: 1,
  },
  "job.rescanSkipped": {
    priority: 250,
    subjectId: (p) => p.feedId,
    title: (p) => `Rescan ${p.skippedCount} skipped job(s)`,
    perList: 1,
  },
  "job.retryFailed": {
    priority: 240,
    subjectId: (p) => p.feedId,
    title: (p) => `Retry ${p.failedCount} failed job(s)`,
    perList: 1,
  },
};

export function makeTask<K extends TaskType>(
  taskType: K,
  payload: TaskPayload<K>,
  priorityBoost = 0,
): PilotTask {
  const def: TaskDef<K> = TASK_DEFS[taskType];
  const subjectId = def.subjectId(payload);
  const fields = { taskType, subjectType: TASK_SUBJECT_TYPES[taskType], subjectId, payload };
  // TS can't narrow a generic union; TASK_DEFS's mapped type already ties each field to K.
  return {
    id: `${taskType}:${subjectId}`,
    priority: def.priority + priorityBoost,
    title: def.title(payload),
    ...fields,
  } as PilotTask;
}

/** The first `perList` payloads as tasks, or all of them for an uncapped type. */
export function makeTasks<K extends TaskType>(
  taskType: K,
  payloads: TaskPayload<K>[],
): PilotTask[] {
  const cap = TASK_DEFS[taskType].perList ?? payloads.length;
  return payloads.slice(0, cap).map((payload) => makeTask(taskType, payload));
}
