"use client";

import type { TaskList } from "@jobpilot/contracts/pilot";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

/** Pinned to one fetch plus manual refresh: building a task list is costly. A stopped pilot has none. */
export function useTaskList(running: boolean): UseQueryResult<TaskList | null> {
  return useQuery({
    ...pilotQueries.taskList(),
    enabled: running,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
