"use client";

import { DEFAULT_CURSOR_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type {
  PilotJournalEntry,
  PilotJournalKind,
  PilotJournalPage,
} from "@jobpilot/contracts/pilot";
import { type Jsonified, pilotChannel } from "@jobpilot/contracts/sse";
import type { QueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { type SseConnectionStatus, useSseChannel } from "@/lib/sse/client";
import { dedupeById } from "@/utils/array";

/** Roomy enough that the fetched page's tail (where `nextCursor` resumes) survives live prepends. */
const CACHE_CAP = DEFAULT_CURSOR_PAGE_SIZE + 100;

/** Journal caches are keyed by their kind filter, and an unfiltered one takes every kind. */
function takesKind(queryKey: readonly unknown[], kind: PilotJournalKind): boolean {
  const { kinds } = (queryKey.at(-1) ?? {}) as { kinds?: PilotJournalKind[] };
  return !kinds?.length || kinds.includes(kind);
}

/** Prepends a streamed entry to every journal cache that takes its kind, so nothing refetches. */
export function appendJournalEntry(
  queryClient: QueryClient,
  streamed: Jsonified<PilotJournalEntry>,
): PilotJournalEntry {
  const entry = { ...streamed, createdAt: new Date(streamed.createdAt) };
  queryClient.setQueriesData<PilotJournalPage>(
    {
      queryKey: pilotQueries.journalAll,
      predicate: (query) => takesKind(query.queryKey, entry.kind),
    },
    (page) => page && { ...page, items: dedupeById([entry, ...page.items]).slice(0, CACHE_CAP) },
  );
  return entry;
}

/** The pilot stream's connection; the shared source means this opens no second connection. */
export function useJournalLiveStatus(): SseConnectionStatus {
  return useSseChannel(pilotChannel, null);
}
