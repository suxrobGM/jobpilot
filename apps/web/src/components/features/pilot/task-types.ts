import type { TaskType } from "@jobpilot/contracts/pilot";

/** `session` is the pilot session doing text-only work itself. */
export type PilotAgent =
  | "job-searcher"
  | "job-scorer"
  | "job-applier"
  | "networking-worker"
  | "session";

export const AGENT_LABELS: Record<PilotAgent, string> = {
  "job-searcher": "Searcher",
  "job-scorer": "Scorer",
  "job-applier": "Applier",
  "networking-worker": "Networker",
  session: "Session",
};

interface TaskTypeInfo {
  label: string;
  agent: PilotAgent;
}

/** Required record, so a new task type fails typecheck; agents match plugin/skills/pilot/tasks/*.md. */
const TASK_TYPES: Record<TaskType, TaskTypeInfo> = {
  "question.answered": { label: "Act on answered question", agent: "job-applier" },
  "job.apply": { label: "Apply to job", agent: "job-applier" },
  "job.applyBatch": { label: "Apply to jobs in parallel", agent: "job-applier" },
  "search.discover": { label: "Run saved search", agent: "job-searcher" },
  "campaign.scorePending": { label: "Score discovered jobs", agent: "job-scorer" },
  "campaign.reviewPaused": { label: "Review paused campaign", agent: "session" },
  "inbox.review": { label: "Review inbox email", agent: "session" },
  "networking.send": { label: "Send networking message", agent: "session" },
  "networking.followup": { label: "Follow up on networking message", agent: "session" },
  "networking.warmIntro": { label: "Ask for a warm intro", agent: "networking-worker" },
  "promotion.draft": { label: "Draft promotion post", agent: "session" },
  "promotion.post": { label: "Publish promotion post", agent: "session" },
  "interview.reply": { label: "Reply about an interview", agent: "session" },
  "interview.prep": { label: "Prepare interview notes", agent: "session" },
  "queue.score": { label: "Score pasted links", agent: "job-scorer" },
  "board.diagnose": { label: "Diagnose job board", agent: "job-applier" },
  "campaign.tune": { label: "Tune a campaign", agent: "session" },
  "job.rescanSkipped": { label: "Rescan skipped jobs", agent: "session" },
  "job.retryFailed": { label: "Retry failed jobs", agent: "session" },
  "search.setup": { label: "Set up goals and saved searches", agent: "session" },
  "upwork.syncInbox": { label: "Refresh the Upwork inbox", agent: "session" },
};

/** Cost history still holds types the task list no longer emits, so unknown ones fall back. */
function taskTypeInfo(taskType: string): TaskTypeInfo {
  const known = (TASK_TYPES as Record<string, TaskTypeInfo | undefined>)[taskType];
  return known ?? { label: taskType, agent: "session" };
}

export function taskTypeLabel(taskType: string): string {
  return taskTypeInfo(taskType).label;
}

export function taskTypeAgent(taskType: string): PilotAgent {
  return taskTypeInfo(taskType).agent;
}
