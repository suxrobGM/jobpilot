"use client";

import { DEFAULT_CURSOR_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type {
  PilotJournalEntry,
  PilotJournalKind,
  PilotJournalPage,
} from "@jobpilot/contracts/pilot";
import { type Jsonified, pilotChannel } from "@jobpilot/contracts/sse";
import {
  type InfiniteData,
  type QueryClient,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { type SseConnectionStatus, useSseChannel } from "@/hooks/use-sse-channel";
import { dedupeById } from "@/utils/array";

type JournalData = InfiniteData<PilotJournalPage, string | null>;

/** Roomy enough that the fetched page's tail (where `nextCursor` resumes) survives live prepends. */
const CACHE_CAP = DEFAULT_CURSOR_PAGE_SIZE + 100;

/** Journal caches are keyed by their kind filter, and an unfiltered one takes every kind. */
function matchesKindFilter(queryKey: readonly unknown[], kind: PilotJournalKind): boolean {
  const { kinds } = (queryKey.at(-1) ?? {}) as { kinds?: PilotJournalKind[] };
  return !kinds?.length || kinds.includes(kind);
}

/** Prepends a streamed entry to every journal cache that takes its kind, so nothing refetches. */
export function prependJournalEntry(
  queryClient: QueryClient,
  streamed: Jsonified<PilotJournalEntry>,
): PilotJournalEntry {
  const entry = { ...streamed, createdAt: new Date(streamed.createdAt) };
  queryClient.setQueriesData<JournalData>(
    {
      queryKey: pilotQueries.journalAll,
      predicate: (query) => matchesKindFilter(query.queryKey, entry.kind),
    },
    (data) => {
      const [first, ...rest] = data?.pages ?? [];
      if (!data || !first) {
        return data;
      }
      const items = dedupeById([entry, ...first.items]).slice(0, CACHE_CAP);
      return { ...data, pages: [{ ...first, items }, ...rest] };
    },
  );
  return entry;
}

/** Trims every journal cache to its first page before refetching, so a refetch costs one request. */
export function refetchJournal(queryClient: QueryClient): void {
  queryClient.setQueriesData<JournalData>(
    { queryKey: pilotQueries.journalAll },
    (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
  );
  void queryClient.invalidateQueries({ queryKey: pilotQueries.journalAll });
}

/** The newest unfiltered page, read from the journal tab's cache. */
export function useLatestJournalPage(): UseInfiniteQueryResult<PilotJournalPage | undefined> {
  return useInfiniteQuery({
    ...pilotQueries.journalFeed([]),
    select: (data) => data.pages[0],
  });
}

/** The pilot stream's connection; the shared source means this opens no second connection. */
export function useJournalLiveStatus(): SseConnectionStatus {
  return useSseChannel(pilotChannel, null);
}
