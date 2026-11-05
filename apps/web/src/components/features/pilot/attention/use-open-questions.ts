"use client";

import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
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
  const query = useQuery(pilotQueries.questions("open"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: pilotQueries.questionsAll });
  };

  // Repeats PilotLive's handlers because the nav badge lives outside the pilot layout.
  useSseChannel(pilotChannel, null, {
    on: { "question.created": refresh, "question.answered": refresh },
  });

  return {
    questions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
