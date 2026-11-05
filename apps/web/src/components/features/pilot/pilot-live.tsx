"use client";

import type { ReactNode } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { appendJournalEntry } from "./journal/journal-cache";

const STATE = pilotQueries.state().queryKey;
// A run moves the state and can change job alerts and research; never `pilot.all`, which would
// rebuild the task list.
const RUN_KEYS = [STATE, pilotQueries.jobAlerts().queryKey, pilotQueries.research().queryKey];

/** The app's one pilot subscription, in the shell so the nav badge and every pilot view share it. */
export function PilotLive(): ReactNode {
  const queryClient = useQueryClient();

  useLiveInvalidation(pilotChannel, null, {
    on: {
      "state.changed": RUN_KEYS,
      "run.started": RUN_KEYS,
      "run.finished": RUN_KEYS,
      // Written straight into the cache rather than refetched.
      "journal.appended": (event) => {
        const entry = appendJournalEntry(queryClient, event.entry);
        if (entry.kind === "cycle") {
          void queryClient.invalidateQueries({ queryKey: STATE });
        }
      },
      "question.created": [pilotQueries.questionsAll],
      "question.answered": [pilotQueries.questionsAll],
      "promotion.created": [pilotQueries.promotionsAll],
      "promotion.updated": [pilotQueries.promotionsAll],
    },
    onReconnect: [
      STATE,
      pilotQueries.journalAll,
      pilotQueries.questionsAll,
      pilotQueries.promotionsAll,
    ],
  });

  return null;
}
