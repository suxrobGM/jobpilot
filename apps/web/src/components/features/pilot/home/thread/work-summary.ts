import type {
  PilotThreadItem,
  PilotThreadJob,
  PilotThreadRun,
  PilotThreadSearchTally,
} from "@jobpilot/contracts/pilot";
import { humanizeIsoInText, plural } from "@/utils/format";

export type WorkItem = Extract<PilotThreadItem, { type: "work" }>;

/** Folded into the tally line, or already shown as the pilot's chat message. */
const FOLDED_TASK_TYPES = new Set(["search.discover", "feed.score", "chat.reply"]);

export function shownRuns(item: WorkItem): PilotThreadRun[] {
  return item.runs.filter((run) => !FOLDED_TASK_TYPES.has(run.taskType));
}

export function isApplied(run: PilotThreadRun): boolean {
  return run.applied && run.job !== null;
}

function jobWithScore(job: PilotThreadJob): string {
  return job.score === null ? job.company : `${job.company} (${job.score})`;
}

function listJoin(parts: string[]): string {
  if (parts.length <= 2) {
    return parts.join(" and ");
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function tallyLine(tally: PilotThreadSearchTally): string {
  const parts: string[] = [];
  if (tally.searches > 0) {
    parts.push(`Searched ${plural(tally.searches, "time")}`, plural(tally.newJobs, "new job"));
  }
  if (tally.scored > 0) {
    parts.push(`${tally.passed} of ${tally.scored} scored cleared your bar`);
  }
  if (tally.best?.score != null) {
    parts.push(`best ${jobWithScore(tally.best)}`);
  }
  return parts.join(" · ");
}

/** The pilot's own words for a sitting, built from what it did rather than its raw run notes. */
export function workSummary(item: WorkItem): string {
  const runs = shownRuns(item);
  if (runs.length === 0) {
    return item.searchTally ? `${tallyLine(item.searchTally)}.` : "Checked in, nothing to do.";
  }
  const sentences: string[] = [];
  const applied = runs.filter(isApplied);
  if (applied.length > 0) {
    const jobs = applied.flatMap((run) => (run.job ? [jobWithScore(run.job)] : []));
    sentences.push(`Applied to ${listJoin(jobs)}.`);
  }
  const failed = runs.filter((run) => run.outcome === "failed").length;
  if (failed > 0) {
    sentences.push(`${plural(failed, "task")} didn't go through.`);
  }
  if (sentences.length > 0) {
    return sentences.join(" ");
  }
  if (runs.length === 1) {
    return humanizeIsoInText(runs[0].summary);
  }
  return `Finished ${plural(runs.length, "task")}.`;
}
