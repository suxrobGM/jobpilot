"use client";

import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PILOT_JOURNAL_PAGE_SIZE } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { type SseConnectionStatus, useSseChannel } from "@/lib/sse/client";
import { dedupeById } from "./journal-row";

/** Cap the live buffer so a long-lived session doesn't grow unbounded; oldest (tail) drop first. */
const LIVE_CAP = 100;

/** Roomy enough that the fetched page's tail (where `nextCursor` resumes) survives live prepends. */
const CACHE_CAP = PILOT_JOURNAL_PAGE_SIZE + LIVE_CAP;

/** The journal route's response shape; the query cache stores the unwrapped Eden data. */
interface JournalPage {
  items: PilotJournalEntry[];
  nextCursor: string | null;
}

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
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<PilotJournalEntry[]>([]);

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "journal.appended": (event) => {
        const entry = fromEvent(event.entry);
        setEntries((prev) => [entry, ...prev].slice(0, LIVE_CAP));
        // Write through: this buffer dies with the mount, and the 30s staleTime would
        // serve a freshly mounted tab the pre-entry cached page.
        queryClient.setQueryData<JournalPage>(
          queryKeys.pilot.journal(),
          (page) =>
            page && { ...page, items: dedupeById([entry, ...page.items]).slice(0, CACHE_CAP) },
        );
      },
    },
  });

  return { entries, status };
}
