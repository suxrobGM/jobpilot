"use client";

import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useState } from "react";
import { type SseConnectionStatus, useSseChannel } from "@/lib/sse/client";

/** Cap the live buffer so a long-lived session doesn't grow unbounded; oldest (tail) drop first. */
const LIVE_CAP = 100;

/** SSE delivers raw JSON, so `createdAt` arrives as an ISO string, not a revived Date. */
function fromEvent(entry: unknown): PilotJournalEntry {
  const raw = entry as PilotJournalEntry & { createdAt: string };
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

interface JournalLive {
  /** Newest-first, streamed since mount. Merge with the fetched page via `dedupeById`. */
  entries: PilotJournalEntry[];
  status: SseConnectionStatus;
}

/** Live journal buffer shared by the Overview strip and the Activity feed. */
export function useJournalLive(): JournalLive {
  const [entries, setEntries] = useState<PilotJournalEntry[]>([]);

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "journal.appended": (event) => {
        setEntries((prev) => [fromEvent(event.entry), ...prev].slice(0, LIVE_CAP));
      },
    },
  });

  return { entries, status };
}
