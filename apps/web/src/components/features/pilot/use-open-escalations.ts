"use client";

import type { Escalation } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";

interface OpenEscalations {
  escalations: Escalation[];
  count: number;
  isLoading: boolean;
}

/** Open-escalation feed shared by the pilot list and the nav badge; kept live via pilotChannel. */
export function useOpenEscalations(): OpenEscalations {
  const queryClient = useQueryClient();
  const query = useApiQuery(pilotQueries.escalations("open"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.pilot.all, "escalations"] });
  };

  useSseChannel(pilotChannel, null, {
    on: { "escalation.created": refresh, "escalation.answered": refresh },
  });

  const escalations = query.data ?? [];
  return { escalations, count: escalations.length, isLoading: query.isLoading };
}
