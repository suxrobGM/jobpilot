"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";
import { appendJournalEntry } from "./journal/use-journal-live";

/** The pilot layout's one SSE subscription; journal entries go straight into the cache, not a refetch. */
export function PilotLive(): ReactNode {
  const queryClient = useQueryClient();

  const invalidate = (queryKey: readonly unknown[]): void => {
    queryClient.invalidateQueries({ queryKey });
  };
  const refreshQuestions = (): void => invalidate(queryKeys.pilot.questionsAll());
  const refreshPromotions = (): void => invalidate(queryKeys.pilot.promotionsAll());
  const refreshState = (): void => invalidate(queryKeys.pilot.state());

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "state.changed": refreshState,
      "run.started": refreshState,
      "run.finished": refreshState,
      "journal.appended": (event) => {
        const entry = appendJournalEntry(queryClient, event.entry);
        // A cycle entry moves the state's last cycle and next wake.
        if (entry.kind === "cycle") {
          refreshState();
        }
      },
      "question.created": refreshQuestions,
      "question.answered": refreshQuestions,
      "question.closed": refreshQuestions,
      "promotion.created": refreshPromotions,
      "promotion.updated": refreshPromotions,
    },
  });

  // Catch up on events missed while reconnecting. Never `pilot.all`: that would rebuild the task list.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current === "reconnecting" && status === "open") {
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.journalAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.questionsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pilot.promotionsAll() });
    }
    previousStatus.current = status;
  }, [status, queryClient]);

  return null;
}
