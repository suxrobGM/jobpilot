import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { format, isToday } from "date-fns";
import { formatDayLabel, plural } from "@/utils/format";

export interface ThreadRow {
  item: PilotThreadItem;
  repeats: number;
}

export type ThreadSegment =
  | { type: "row"; row: ThreadRow }
  | { type: "fold"; key: string; rows: ThreadRow[] };

/** Fewer quiet rows than this in a row read fine on their own. */
const MIN_FOLD = 3;

export function rowKey(item: PilotThreadItem): string {
  return `${item.type}:${item.id}`;
}

/** Restart reports and other identical notes in a row read as noise; keep the latest, counted. */
export function collapseRepeats(items: PilotThreadItem[]): ThreadRow[] {
  const rows: ThreadRow[] = [];
  for (const item of items) {
    const last = rows.at(-1);
    const sameNote =
      last?.item.type === "note" &&
      item.type === "note" &&
      last.item.entry.summary === item.entry.summary &&
      formatDayLabel(last.item.at) === formatDayLabel(item.at);
    if (last && sameNote) {
      rows[rows.length - 1] = { item, repeats: last.repeats + 1 };
    } else {
      rows.push({ item, repeats: 1 });
    }
  }
  return rows;
}

/** History worth a glance, not a read: morning summaries, host notes, settled questions. */
function isQuiet(item: PilotThreadItem): boolean {
  if (item.type === "question") {
    return item.question.status !== "open";
  }
  // Today stays open: it's what the user came to check.
  return (item.type === "digest" || item.type === "note") && !isToday(item.at);
}

/** Runs of quiet rows fold into one line, so the work and the conversation stand out. */
export function foldQuietRuns(rows: ThreadRow[]): ThreadSegment[] {
  const segments: ThreadSegment[] = [];
  let run: ThreadRow[] = [];
  const flush = (): void => {
    if (run.length >= MIN_FOLD) {
      segments.push({ type: "fold", key: rowKey(run[0].item), rows: run });
    } else {
      segments.push(...run.map((row) => ({ type: "row" as const, row })));
    }
    run = [];
  };
  for (const row of rows) {
    if (isQuiet(row.item)) {
      run.push(row);
      continue;
    }
    flush();
    segments.push({ type: "row", row });
  }
  flush();
  return segments;
}

const FOLD_NOUNS: Partial<Record<PilotThreadItem["type"], [string, string]>> = {
  digest: ["daily summary", "daily summaries"],
  question: ["answered question", "answered questions"],
  note: ["note", "notes"],
};

/** "Aug 1 – Oct 4 · 9 daily summaries, 6 answered questions". */
export function foldLabel(rows: ThreadRow[]): string {
  const first = rows[0].item.at;
  const last = rows[rows.length - 1].item.at;
  const from = format(first, "MMM d");
  const to = format(last, "MMM d");
  const span = from === to ? from : `${from} – ${to}`;
  const counts = (["digest", "question", "note"] as const).flatMap((type) => {
    const count = rows.filter((row) => row.item.type === type).length;
    const nouns = FOLD_NOUNS[type];
    return count > 0 && nouns ? [plural(count, nouns[0], nouns[1])] : [];
  });
  return `${span} · ${counts.join(", ")}`;
}
