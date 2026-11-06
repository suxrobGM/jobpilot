import type { PilotJournalEntry, PilotJournalRun } from "@jobpilot/contracts/pilot";
import { format } from "date-fns";
import { formatDayLabel } from "@/utils/format";

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
    days.push({ key, label: formatDayLabel(date), entries: [entry] });
  }
  return days;
}
