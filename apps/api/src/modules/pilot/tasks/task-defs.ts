import type { PilotTask, TaskPayload, TaskSubjectType, TaskType } from "@jobpilot/contracts/pilot";
import { jobSubjectId } from "./run-history";

interface TaskDef<K extends TaskType> {
  /** Higher runs first; `job.apply` adds its matchScore, so a perfect match reaches 900. */
  priority: number;
  subjectType: TaskSubjectType<K>;
  subjectId: (payload: TaskPayload<K>) => string;
  title: (payload: TaskPayload<K>) => string;
  /** At most this many per task list; the rest drain over later cycles. */
  perList?: number;
}

/** One entry per task type: a new type fails typecheck until it has its priority and subject. */
export const TASK_DEFS: { [K in TaskType]: TaskDef<K> } = {
  "question.answered": {
    priority: 1000,
    subjectType: "question",
    subjectId: (p) => p.questionId,
    title: (p) => `Apply answer: ${p.prompt}`,
  },
  "interview.reply": {
    priority: 950,
    subjectType: "email",
    subjectId: (p) => p.emailMessageId,
    title: (p) => `Reply to interview invite: ${p.company}`,
    perList: 2,
  },
  // Above any apply: probe a failing board before more attempts pile onto it.
  "board.diagnose": {
    priority: 920,
    subjectType: "board",
    subjectId: (p) => p.jobBoardId,
    title: (p) => `Board failing: ${p.board} (${p.consecutiveFailures})`,
    perList: 1,
  },
  // Above any apply, or a list full of applies would starve a stranded campaign out of the top 10.
  "campaign.reviewPaused": {
    priority: 910,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
    title: (p) => `Review paused campaign: ${p.query}`,
    perList: 1,
  },
  "job.apply": {
    priority: 800,
    subjectType: "job",
    subjectId: (p) => jobSubjectId({ campaignId: p.campaignId, key: p.jobKey }),
    title: (p) => p.jobTitle,
  },
  "interview.prep": {
    priority: 750,
    subjectType: "application",
    subjectId: (p) => p.applicationId,
    title: (p) => `Interview prep: ${p.jobTitle}`,
    perList: 1,
  },
  "queue.score": {
    priority: 720,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
    title: (p) => `Score ${p.queuedCount} pasted link(s)`,
  },
  "networking.send": {
    priority: 700,
    subjectType: "networking",
    subjectId: (p) => p.messageId,
    title: (p) => `Send networking message: ${p.contactName}`,
  },
  "inbox.review": {
    priority: 650,
    subjectType: "inbox",
    subjectId: () => "inbox",
    title: (p) => `Review ${p.count} inbox message(s)`,
  },
  "upwork.syncInbox": {
    priority: 640,
    subjectType: "upwork",
    subjectId: () => "inbox",
    title: (p) => (p.lastSyncedAt ? "Refresh the Upwork inbox" : "Pull the Upwork inbox"),
  },
  "promotion.post": {
    priority: 600,
    subjectType: "promotion",
    subjectId: (p) => p.promotionId,
    title: (p) => `Post to ${p.platform}`,
  },
  "networking.warmIntro": {
    priority: 550,
    subjectType: "networking",
    subjectId: (p) => jobSubjectId({ campaignId: p.campaignId, key: p.jobKey }),
    title: (p) => `Warm intro: ${p.jobTitle}`,
    perList: 1,
  },
  "search.setup": {
    priority: 520,
    subjectType: "pilot",
    subjectId: () => "setup",
    title: () => "Set up searches from your goals",
  },
  // Finish scoring what was found before discovering more.
  "campaign.scorePending": {
    priority: 510,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
    title: (p) => `Score discovered jobs: ${p.query}`,
  },
  // Alert links are pre-filtered by the board, so import them before discovering more.
  "inbox.jobAlerts": {
    priority: 505,
    subjectType: "inbox",
    subjectId: () => "jobAlerts",
    title: (p) => `Import jobs from ${p.count} alert email(s)`,
  },
  "search.discover": {
    priority: 500,
    subjectType: "campaign",
    subjectId: (p) => p.searchId,
    title: (p) => `Discover: ${p.query}`,
  },
  "networking.followup": {
    priority: 400,
    subjectType: "networking",
    subjectId: (p) => p.messageId,
    title: (p) => `Follow up: ${p.contactName}`,
    perList: 2,
  },
  "campaign.tune": {
    priority: 350,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
    title: (p) => `Tune campaign: ${p.query}`,
    perList: 1,
  },
  "promotion.draft": {
    priority: 300,
    subjectType: "promotion",
    subjectId: (p) => `platform:${p.platform}`,
    title: (p) => `Draft post: ${p.platform}`,
    perList: 1,
  },
  "job.rescanSkipped": {
    priority: 250,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
    title: (p) => `Rescan ${p.skippedCount} skipped job(s)`,
    perList: 1,
  },
  "job.retryFailed": {
    priority: 240,
    subjectType: "campaign",
    subjectId: (p) => p.campaignId,
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
  const fields = { taskType, subjectType: def.subjectType, subjectId, payload };
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
