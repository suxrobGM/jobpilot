"use client";

import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";

/**
 * The pilot layout's single SSE subscription: fans pilot events out to query
 * invalidations so tab components don't each hold their own handler set.
 * `journal.appended` is deliberately unhandled - `useJournalLive` owns the
 * live buffer and merges entries without a refetch.
 */
export function usePilotLive(): void {
  const queryClient = useQueryClient();

  const invalidate = (queryKey: readonly unknown[]): void => {
    queryClient.invalidateQueries({ queryKey });
  };
  const refreshQuestions = (): void => invalidate(queryKeys.pilot.questionsAll());
  const refreshPromotions = (): void => invalidate(queryKeys.pilot.promotionsAll());

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "state.changed": () => invalidate(queryKeys.pilot.state()),
      "question.created": refreshQuestions,
      "question.answered": refreshQuestions,
      "promotion.created": refreshPromotions,
      "promotion.updated": refreshPromotions,
    },
  });

  // After a reconnect, refetch what SSE events may have been missed during the gap.
  // Keys are listed individually - never `pilot.all` - so the mount-only agenda
  // query is never refetched implicitly.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "reconnecting" && status === "open") {
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.journal() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.questionsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.promotionsAll() });
    }
    prevStatus.current = status;
  }, [status, queryClient]);
}
