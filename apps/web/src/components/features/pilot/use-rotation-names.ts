"use client";

import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries, pilotQueries } from "@/api/queries";

/** The checked boards' names in rotation order. */
export function useRotationNames(): string[] {
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const rotation = useQuery(pilotQueries.state()).data?.config.boards ?? [];
  return rotation.map((domain) => boards.find((board) => board.domain === domain)?.name ?? domain);
}
