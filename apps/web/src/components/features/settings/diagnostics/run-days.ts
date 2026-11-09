import type { PilotRunHistoryItem } from "@jobpilot/contracts/pilot";
import { format } from "date-fns";
import { formatDayLabel } from "@/utils/format";

interface RunDay {
  key: string;
  label: string;
  runs: PilotRunHistoryItem[];
}

/** Runs arrive newest first, so each day's rows are contiguous. */
export function groupByDay(runs: PilotRunHistoryItem[]): RunDay[] {
  const days: RunDay[] = [];
  for (const run of runs) {
    const date = new Date(run.finishedAt);
    const key = format(date, "yyyy-MM-dd");
    const last = days.at(-1);
    if (last?.key === key) {
      last.runs.push(run);
      continue;
    }
    days.push({ key, label: formatDayLabel(date), runs: [run] });
  }
  return days;
}
