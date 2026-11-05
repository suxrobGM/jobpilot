"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { useSseChannel } from "@/lib/sse/client";
import { appendJournalEntry } from "./journal/use-journal-live";

/** The pilot layout's one SSE subscription; journal entries go straight into the cache, not a refetch. */
export function PilotLive(): ReactNode {
  const queryClient = useQueryClient();

  const invalidate = (queryKey: readonly unknown[]): void => {
    queryClient.invalidateQueries({ queryKey });
  };
  const refreshQuestions = (): void => invalidate(pilotQueries.questionsAll);
  const refreshPromotions = (): void => invalidate(pilotQueries.promotionsAll);
  const refreshState = (): void => invalidate(pilotQueries.state().queryKey);
  const refreshRuns = (): void => {
    refreshState();
    invalidate(pilotQueries.jobAlerts().queryKey);
    invalidate(pilotQueries.research().queryKey);
  };

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "state.changed": refreshRuns,
      "run.started": refreshRuns,
      "run.finished": refreshRuns,
      "journal.appended": (event) => {
        const entry = appendJournalEntry(queryClient, event.entry);
        // A cycle entry moves the state's last cycle and next wake.
        if (entry.kind === "cycle") {
          refreshState();
        }
      },
      "question.created": refreshQuestions,
      "question.answered": refreshQuestions,
      "promotion.created": refreshPromotions,
      "promotion.updated": refreshPromotions,
    },
  });

  // Catch up on events missed while reconnecting. Never `pilot.all`: that would rebuild the task list.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current === "reconnecting" && status === "open") {
      queryClient.invalidateQueries({ queryKey: pilotQueries.state().queryKey });
      queryClient.invalidateQueries({ queryKey: pilotQueries.journalAll });
      queryClient.invalidateQueries({ queryKey: pilotQueries.questionsAll });
      queryClient.invalidateQueries({ queryKey: pilotQueries.promotionsAll });
    }
    previousStatus.current = status;
  }, [status, queryClient]);

  return null;
}
