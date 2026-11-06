import type { PilotThreadPage } from "@jobpilot/contracts/pilot";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { coalesce } from "@/utils/coalesce";

type ThreadData = InfiniteData<PilotThreadPage, string | null>;

/** Trims to the newest page before refetching, so a burst of live events costs one request. */
export function refetchThread(queryClient: QueryClient): void {
  coalesce("pilot-thread", () => {
    queryClient.setQueriesData<ThreadData>(
      { queryKey: pilotQueries.threadAll },
      (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
    );
    void queryClient.invalidateQueries({ queryKey: pilotQueries.threadAll });
  });
}
