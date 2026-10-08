import type { NetworkingMode } from "@jobpilot/contracts/networking";
import type { PilotTask, TaskPayload, TaskType } from "@jobpilot/contracts/pilot";
import type { TaskJob } from "./gather-jobs";
import { jobSubjectId } from "./run-history";

// job.apply adds its matchScore, so a perfect match reaches 900.
const PRIORITY: Record<TaskType, number> = {
  "question.answered": 1000,
  "interview.reply": 950,
  // Above any apply: probe a failing board before more attempts pile onto it.
  "board.diagnose": 920,
  // Above any apply, or a list full of applies would starve a stranded campaign out of the top 10.
  "campaign.reviewPaused": 910,
  "job.apply": 800,
  "interview.prep": 750,
  "queue.score": 720,
  "networking.send": 700,
  "inbox.review": 650,
  "upwork.syncInbox": 640,
  "promotion.post": 600,
  "networking.warmIntro": 550,
  "search.setup": 520,
  // Finish scoring what was found before discovering more.
  "campaign.scorePending": 510,
  // Scheduled, so it waits behind applies; above discovery since alert links are pre-filtered.
  "inbox.jobAlerts": 505,
  "search.discover": 500,
  "networking.followup": 400,
  "campaign.tune": 350,
  "promotion.draft": 300,
  "job.rescanSkipped": 250,
  "job.retryFailed": 240,
};

function task<K extends TaskType>(
  taskType: K,
  subjectType: PilotTask["subjectType"],
  subjectId: string,
  title: string,
  payload: TaskPayload<K>,
): PilotTask {
  const fields = { taskType, subjectType, subjectId, payload, title };
  // TS can't narrow a generic union; the parameter types already tie taskType to its payload.
  return { id: `${taskType}:${subjectId}`, priority: PRIORITY[taskType], ...fields } as PilotTask;
}

export const questionTask = (payload: TaskPayload<"question.answered">) =>
  task(
    "question.answered",
    "question",
    payload.questionId,
    `Apply answer: ${payload.prompt}`,
    payload,
  );

export const applyTask = (job: TaskJob): PilotTask => ({
  ...task("job.apply", "job", jobSubjectId(job), job.title, {
    campaignId: job.campaignId,
    jobKey: job.key,
    url: job.url,
    board: job.board,
    brief: job.brief,
    resumeId: job.resumeId,
    matchScore: job.matchScore,
    warmContacts: job.warmContacts,
  }),
  priority: PRIORITY["job.apply"] + (job.matchScore ?? 0),
});

/** An empty contact list still earns the task: finding a first contact is the point. */
export const warmIntroTask = (job: TaskJob, mode: NetworkingMode) =>
  task("networking.warmIntro", "networking", jobSubjectId(job), `Warm intro: ${job.title}`, {
    campaignId: job.campaignId,
    jobKey: job.key,
    company: job.company,
    jobTitle: job.title,
    jobUrl: job.url,
    contacts: job.warmContacts ?? [],
    ...mode,
  });

export const discoverTask = (payload: TaskPayload<"search.discover">) =>
  task("search.discover", "campaign", payload.searchId, `Discover: ${payload.query}`, payload);

export const scorePendingTask = (payload: TaskPayload<"campaign.scorePending">) =>
  task(
    "campaign.scorePending",
    "campaign",
    payload.campaignId,
    `Score discovered jobs: ${payload.query}`,
    payload,
  );

export const reviewPausedTask = (payload: TaskPayload<"campaign.reviewPaused">) =>
  task(
    "campaign.reviewPaused",
    "campaign",
    payload.campaignId,
    `Review paused campaign: ${payload.query}`,
    payload,
  );

export const queueScoreTask = (payload: TaskPayload<"queue.score">) =>
  task(
    "queue.score",
    "campaign",
    payload.campaignId,
    `Score ${payload.queuedCount} pasted link(s)`,
    payload,
  );

export const networkingSendTask = (payload: TaskPayload<"networking.send">) =>
  task(
    "networking.send",
    "networking",
    payload.messageId,
    `Send networking message: ${payload.contactName}`,
    payload,
  );

export const followupTask = (payload: TaskPayload<"networking.followup">) =>
  task(
    "networking.followup",
    "networking",
    payload.messageId,
    `Follow up: ${payload.contactName}`,
    payload,
  );

export const inboxTask = (payload: TaskPayload<"inbox.review">) =>
  task("inbox.review", "inbox", "inbox", `Review ${payload.count} inbox message(s)`, payload);

export const jobAlertsTask = (payload: TaskPayload<"inbox.jobAlerts">) =>
  task(
    "inbox.jobAlerts",
    "inbox",
    "jobAlerts",
    `Harvest job links from ${payload.count} alert email(s)`,
    payload,
  );

export const interviewReplyTask = (payload: TaskPayload<"interview.reply">) =>
  task(
    "interview.reply",
    "email",
    payload.emailMessageId,
    `Reply to interview invite: ${payload.company}`,
    payload,
  );

export const interviewPrepTask = (payload: TaskPayload<"interview.prep">) =>
  task(
    "interview.prep",
    "application",
    payload.applicationId,
    `Interview prep: ${payload.jobTitle}`,
    payload,
  );

export const promotionPostTask = (payload: TaskPayload<"promotion.post">) =>
  task("promotion.post", "promotion", payload.promotionId, `Post to ${payload.platform}`, payload);

export const promotionDraftTask = (payload: TaskPayload<"promotion.draft">) =>
  task(
    "promotion.draft",
    "promotion",
    `platform:${payload.platform}`,
    `Draft post: ${payload.platform}`,
    payload,
  );

export const upworkSyncTask = (payload: TaskPayload<"upwork.syncInbox">) =>
  task(
    "upwork.syncInbox",
    "upwork",
    "inbox",
    payload.lastSyncedAt ? "Refresh the Upwork inbox" : "Pull the Upwork inbox",
    payload,
  );

export const boardDiagnoseTask = (payload: TaskPayload<"board.diagnose">) =>
  task(
    "board.diagnose",
    "board",
    payload.board,
    `Board failing: ${payload.board} (${payload.consecutiveFailures})`,
    payload,
  );

export const tuneTask = (payload: TaskPayload<"campaign.tune">) =>
  task("campaign.tune", "campaign", payload.campaignId, `Tune campaign: ${payload.query}`, payload);

export const rescanSkippedTask = (payload: TaskPayload<"job.rescanSkipped">) =>
  task(
    "job.rescanSkipped",
    "campaign",
    payload.campaignId,
    `Rescan ${payload.skippedCount} skipped job(s)`,
    payload,
  );

export const retryFailedTask = (payload: TaskPayload<"job.retryFailed">) =>
  task(
    "job.retryFailed",
    "campaign",
    payload.campaignId,
    `Retry ${payload.failedCount} failed job(s)`,
    payload,
  );

export const setupTask = (payload: TaskPayload<"search.setup">) =>
  task("search.setup", "pilot", "setup", "Set up searches from your goals", payload);
