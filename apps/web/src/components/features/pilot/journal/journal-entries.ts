import type { PilotJournalEntry, PilotJournalRun } from "@jobpilot/contracts/pilot";
import { format, isThisYear, isToday, isYesterday } from "date-fns";

/** Drops cycle rows whose actions already repeat them; lone (error) cycle rows stay. */
export function collapseCoveredCycles(entries: PilotJournalEntry[]): PilotJournalEntry[] {
  const covered = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === "action" && entry.runId) {
      covered.add(entry.runId);
    }
  }
  return entries.filter((e) => !(e.kind === "cycle" && e.runId && covered.has(e.runId)));
}

/** Streamed actions predate the host's usage report, so every row takes its run's newest copy. */
export function withLatestRuns(entries: PilotJournalEntry[]): PilotJournalEntry[] {
  const runs = new Map<string, PilotJournalRun>();
  for (const entry of entries) {
    if (entry.runId && entry.run && !runs.has(entry.runId)) {
      runs.set(entry.runId, entry.run);
    }
  }
  return entries.map((entry) => {
    const run = entry.runId ? runs.get(entry.runId) : null;
    return run ? { ...entry, run } : entry;
  });
}

interface JournalDay {
  key: string;
  label: string;
  entries: PilotJournalEntry[];
}

function dayLabel(date: Date): string {
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, isThisYear(date) ? "EEEE, MMM d" : "MMM d, yyyy");
}

/** Entries arrive newest first, so each day's rows are contiguous. */
export function groupByDay(entries: PilotJournalEntry[]): JournalDay[] {
  const days: JournalDay[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const last = days.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
      continue;
    }
    days.push({ key, label: dayLabel(date), entries: [entry] });
  }
  return days;
}
