"use client";

import type { ReactNode } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { prependJournalEntry, refetchJournal } from "./journal/journal-cache";

const STATE_KEY = pilotQueries.state().queryKey;
// Never `pilot.all`: it would rebuild the task list.
const RUN_KEYS = [STATE_KEY, pilotQueries.jobAlerts().queryKey, pilotQueries.research().queryKey];
const RECONNECT_KEYS = [STATE_KEY, pilotQueries.questionsAll, pilotQueries.promotionsAll];

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
        const entry = prependJournalEntry(queryClient, event.entry);
        if (entry.kind === "cycle") {
          void queryClient.invalidateQueries({ queryKey: STATE_KEY });
        }
      },
      "question.created": [pilotQueries.questionsAll],
      "question.answered": [pilotQueries.questionsAll],
      "promotion.created": [pilotQueries.promotionsAll],
      "promotion.updated": [pilotQueries.promotionsAll],
    },
    onReconnect: () => {
      refetchJournal(queryClient);
      for (const queryKey of RECONNECT_KEYS) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return null;
}
