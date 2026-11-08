import type { TaskType } from "./tasks";

/** `session` is the pilot session doing text-only work itself. */
export type PilotAgent =
  | "job-searcher"
  | "job-researcher"
  | "job-scorer"
  | "job-applier"
  | "networking-worker"
  | "session";

export const AGENT_LABELS: Record<PilotAgent, string> = {
  "job-searcher": "Searcher",
  "job-researcher": "Researcher",
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
  "search.discover": { label: "Run saved search", agent: "job-searcher" },
  "feed.score": { label: "Score discovered jobs", agent: "job-scorer" },
  "search.review": { label: "Review a paused search", agent: "session" },
  "inbox.review": { label: "Review inbox email", agent: "session" },
  "inbox.jobAlerts": { label: "Import job alert emails", agent: "session" },
  "networking.send": { label: "Send networking message", agent: "session" },
  "networking.followup": { label: "Follow up on networking message", agent: "session" },
  "networking.warmIntro": { label: "Ask for a warm intro", agent: "networking-worker" },
  "interview.reply": { label: "Reply about an interview", agent: "session" },
  "interview.prep": { label: "Prepare interview notes", agent: "session" },
  "queue.score": { label: "Score pasted links", agent: "job-scorer" },
  "board.diagnose": { label: "Diagnose job board", agent: "job-applier" },
  "search.tune": { label: "Tune a search", agent: "session" },
  "job.rescanSkipped": { label: "Rescan skipped jobs", agent: "session" },
  "job.retryFailed": { label: "Retry failed jobs", agent: "session" },
  "search.setup": { label: "Set up searches", agent: "session" },
  "research.explore": { label: "Web search", agent: "job-researcher" },
  "upwork.syncInbox": { label: "Refresh the Upwork inbox", agent: "session" },
  "chat.reply": { label: "Reply to you", agent: "session" },
  "resume.extract": { label: "Read a resume", agent: "session" },
  "resume.tailor": { label: "Tailor a resume", agent: "session" },
  "networking.find": { label: "Find contacts", agent: "networking-worker" },
  "networking.rewrite": { label: "Rewrite outreach drafts", agent: "session" },
  "upwork.profile": { label: "Work on the Upwork profile", agent: "session" },
  "upwork.proposal": { label: "Write an Upwork proposal", agent: "session" },
  "upwork.submit": { label: "Submit an Upwork proposal", agent: "session" },
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
