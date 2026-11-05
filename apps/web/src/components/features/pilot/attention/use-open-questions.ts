"use client";

import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

interface OpenQuestions {
  questions: PilotQuestion[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Shared by the attention list, the nav badge and the dashboard card. */
export function useOpenQuestions(): OpenQuestions {
  const query = useQuery(pilotQueries.questions("open"));

  return {
    questions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
