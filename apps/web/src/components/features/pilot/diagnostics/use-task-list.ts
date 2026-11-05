"use client";

import type { TaskList } from "@jobpilot/contracts/pilot";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

export function useTaskList(): UseQueryResult<TaskList | null> {
  return useQuery(pilotQueries.taskList());
}
