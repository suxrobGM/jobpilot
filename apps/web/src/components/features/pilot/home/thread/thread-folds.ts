import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { format } from "date-fns";
import { plural } from "@/utils/format";

export type ThreadSegment =
  | { type: "row"; item: PilotThreadItem }
  | { type: "fold"; key: string; items: PilotThreadItem[] };

/** Fewer quiet rows than this in a row read fine on their own. */
const MIN_FOLD = 3;

export function rowKey(item: PilotThreadItem): string {
  return `${item.type}:${item.id}`;
}

/** History worth a glance, not a read: questions already settled. */
function isQuiet(item: PilotThreadItem): boolean {
  return item.type === "question" && item.question.status !== "open";
}

/** Runs of quiet rows fold into one line, so the work and the conversation stand out. */
export function foldQuietRuns(items: PilotThreadItem[]): ThreadSegment[] {
  const segments: ThreadSegment[] = [];
  let run: PilotThreadItem[] = [];
  const flush = (): void => {
    if (run.length >= MIN_FOLD) {
      segments.push({ type: "fold", key: rowKey(run[0]), items: run });
    } else {
      segments.push(...run.map((item) => ({ type: "row" as const, item })));
    }
    run = [];
  };
  for (const item of items) {
    if (isQuiet(item)) {
      run.push(item);
      continue;
    }
    flush();
    segments.push({ type: "row", item });
  }
  flush();
  return segments;
}

/** "Aug 1 – Oct 4 · 6 answered questions". */
export function foldLabel(items: PilotThreadItem[]): string {
  const from = format(items[0].at, "MMM d");
  const to = format(items[items.length - 1].at, "MMM d");
  const span = from === to ? from : `${from} – ${to}`;
  return `${span} · ${plural(items.length, "answered question", "answered questions")}`;
}
