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
  count: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Open-question feed shared by the pilot list and the nav badge; kept live via pilotChannel. */
export function useOpenQuestions(): OpenQuestions {
  const queryClient = useQueryClient();
  const query = useApiQuery(pilotQueries.questions("open"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pilot.questionsAll() });
  };

  // Duplicates PilotLive's handlers on /pilot, but the nav badge mounts outside the
  // pilot layout and would otherwise go stale. TanStack dedupes the refetch.
  useSseChannel(pilotChannel, null, {
    on: { "question.created": refresh, "question.answered": refresh },
  });

  const questions = query.data ?? [];
  return {
    questions,
    count: questions.length,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
