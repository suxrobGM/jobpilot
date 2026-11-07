"use client";

import { DEFAULT_PAGE_SIZE, type PaginationQuery } from "@jobpilot/contracts/pagination";
import type {
  PilotJournalEntry,
  PilotJournalKind,
  PilotJournalPage,
} from "@jobpilot/contracts/pilot";
import { type Jsonified, pilotChannel } from "@jobpilot/contracts/sse";
import { type QueryClient, type UseQueryResult, useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { type SseConnectionStatus, useSseChannel } from "@/hooks/use-sse-channel";
import { dedupeById } from "@/utils/array";

interface JournalPageKey extends PaginationQuery {
  kinds: PilotJournalKind[];
}

/** Only page 1 takes live entries: later pages would shift, so they wait for a refetch. */
function takesLiveEntry(queryKey: readonly unknown[], kind: PilotJournalKind): boolean {
  const { kinds, page } = queryKey.at(-1) as JournalPageKey;
  return page === 1 && (kinds.length === 0 || kinds.includes(kind));
}

/** Prepends a streamed entry to every first journal page that takes its kind, so nothing refetches. */
export function prependJournalEntry(
  queryClient: QueryClient,
  streamed: Jsonified<PilotJournalEntry>,
): PilotJournalEntry {
  const entry = { ...streamed, createdAt: new Date(streamed.createdAt) };
  queryClient.setQueriesData<PilotJournalPage>(
    {
      queryKey: pilotQueries.journalAll,
      predicate: (query) => takesLiveEntry(query.queryKey, entry.kind),
    },
    (data) => {
      if (!data) {
        return data;
      }
      const { limit } = data.pagination;
      const items = dedupeById([entry, ...data.items]);
      const total = data.pagination.total + items.length - data.items.length;
      return {
        items: items.slice(0, limit),
        pagination: { ...data.pagination, total, totalPages: Math.ceil(total / limit) },
      };
    },
  );
  return entry;
}

export function refetchJournal(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: pilotQueries.journalAll });
}

/** The newest unfiltered page, shared with the journal's own first page. */
export function useLatestJournalPage(): UseQueryResult<PilotJournalPage> {
  return useQuery(pilotQueries.journalPage([], { page: 1, limit: DEFAULT_PAGE_SIZE }));
}

/** The pilot stream's connection; the shared source means this opens no second connection. */
export function useJournalLiveStatus(): SseConnectionStatus {
  return useSseChannel(pilotChannel, null);
}
