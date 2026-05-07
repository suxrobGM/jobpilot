"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * Subscribe to /api/runs/:runId/events. On every event, invalidate the
 * run detail query so the UI refetches the canonical state. Simpler than
 * doing surgical setQueryData updates and avoids divergence when the
 * server schema evolves.
 */
export function useRunEvents(runId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!runId) return;
    const url = `/api/runs/${encodeURIComponent(runId)}/events`;
    const source = new EventSource(url);

    source.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(runId) });
    };

    source.onerror = () => {
      // Browser handles auto-reconnect for EventSource; nothing to do.
    };

    return () => {
      source.close();
    };
  }, [runId, queryClient]);
}
