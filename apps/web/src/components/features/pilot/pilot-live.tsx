"use client";

import type { ReactNode } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { pilotQueries, pipelineQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { refetchThread } from "./home/thread/thread-cache";
import { prependJournalEntry, refetchJournal } from "./journal/journal-cache";
import { appendRunSteps } from "./steps/steps-cache";

const STATE_KEY = pilotQueries.state().queryKey;
// Never `pilot.all`: it would rebuild the task list.
const RUN_KEYS = [STATE_KEY, pilotQueries.jobAlerts().queryKey, pilotQueries.research().queryKey];
const RECONNECT_KEYS = [
  STATE_KEY,
  pilotQueries.questionsAll,
  pilotQueries.promotionsAll,
  pilotQueries.changesAll,
  pilotQueries.searches().queryKey,
  pilotQueries.notices().queryKey,
];

/** The app's one pilot subscription, in the shell so the nav badge and every pilot view share it. */
export function PilotLive(): ReactNode {
  const queryClient = useQueryClient();

  const invalidate = (keys: readonly (readonly unknown[])[]): void => {
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
    refetchThread(queryClient);
  };

  useLiveInvalidation(pilotChannel, null, {
    on: {
      "state.changed": RUN_KEYS,
      "run.started": () => invalidate(RUN_KEYS),
      "run.finished": () =>
        invalidate([
          ...RUN_KEYS,
          pilotQueries.searches().queryKey,
          pilotQueries.notices().queryKey,
        ]),
      // Written straight into the cache rather than refetched.
      "journal.appended": (event) => {
        const entry = prependJournalEntry(queryClient, event.entry);
        if (entry.kind === "cycle") {
          void queryClient.invalidateQueries({ queryKey: STATE_KEY });
        } else {
          refetchThread(queryClient);
        }
      },
      "question.created": () => invalidate([pilotQueries.questionsAll]),
      "question.answered": () => invalidate([pilotQueries.questionsAll]),
      "promotion.created": () => invalidate([pilotQueries.promotionsAll]),
      "promotion.updated": () => invalidate([pilotQueries.promotionsAll]),
      "run.steps": (event) => appendRunSteps(queryClient, event.runId, event.steps),
      "message.created": () => refetchThread(queryClient),
      "request.created": () => refetchThread(queryClient),
      "request.updated": () => refetchThread(queryClient),
      // A change can touch searches, answers and jobs as well as the state.
      "change.updated": () =>
        invalidate([
          pilotQueries.changesAll,
          pilotQueries.searches().queryKey,
          pilotQueries.savedAnswers().queryKey,
          pipelineQueries.all,
        ]),
    },
    onReconnect: () => {
      refetchJournal(queryClient);
      refetchThread(queryClient);
      for (const queryKey of RECONNECT_KEYS) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return null;
}
