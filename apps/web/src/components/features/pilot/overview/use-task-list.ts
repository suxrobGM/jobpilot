"use client";

import type { TaskList } from "@jobpilot/contracts/pilot";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

/** A stopped pilot has no task list. */
export function useTaskList(pilotRunning: boolean): UseQueryResult<TaskList | null> {
  return useQuery({ ...pilotQueries.taskList(), enabled: pilotRunning });
}
