"use client";

import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { PILOT_JOURNAL_PAGE_SIZE } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { type SseConnectionStatus, useSseChannel } from "@/lib/sse/client";
import { dedupeById } from "@/utils/array";

/** Cap the live buffer so a long-lived session doesn't grow unbounded; oldest (tail) drop first. */
const LIVE_CAP = 100;

/** Roomy enough that the fetched page's tail (where `nextCursor` resumes) survives live prepends. */
const CACHE_CAP = PILOT_JOURNAL_PAGE_SIZE + LIVE_CAP;

/** The journal route's response shape; the query cache stores the unwrapped Eden data. */
interface JournalPage {
  items: PilotJournalEntry[];
  nextCursor: string | null;
}

/**
 * One buffer for every caller: the overview strip, the stage hook, and the feed all
 * mount concurrently, so per-hook state would fan the same event into N copies.
 */
let buffer: PilotJournalEntry[] = [];
const listeners = new Set<() => void>();

/** Each subscriber's SSE handler fires for the same event, so appends must be idempotent. */
function appendEntry(entry: PilotJournalEntry): void {
  if (buffer.some((e) => e.id === entry.id)) {
    return;
  }
  buffer = [entry, ...buffer].slice(0, LIVE_CAP);
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToBuffer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY: PilotJournalEntry[] = [];

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
  const entries = useSyncExternalStore(
    subscribeToBuffer,
    () => buffer,
    () => EMPTY,
  );

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "journal.appended": (event) => {
        const entry = fromEvent(event.entry);
        appendEntry(entry);
        // Write through: this buffer dies with the tab, and the 30s staleTime would
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
