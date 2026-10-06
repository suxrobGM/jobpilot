"use client";

import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";

interface OpenQuestions {
  questions: PilotQuestion[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Shared by the attention list, the nav badge and the dashboard card. */
export function useOpenQuestions(): OpenQuestions {
  const queryClient = useQueryClient();
  const query = useApiQuery(pilotQueries.questions("open"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pilot.questionsAll() });
  };

  // Repeats PilotLive's handlers because the nav badge lives outside the pilot layout.
  useSseChannel(pilotChannel, null, {
    on: { "question.created": refresh, "question.answered": refresh, "question.closed": refresh },
  });

  return {
    questions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
