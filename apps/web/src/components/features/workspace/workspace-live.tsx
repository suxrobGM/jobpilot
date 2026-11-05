"use client";

import type { ReactNode } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { useQueryClient } from "@tanstack/react-query";
import { applicationQueries, campaignQueries } from "@/api/queries";
import { useSseChannel } from "@/lib/sse/client";

/** The workspace layout's one SSE subscription; any event refreshes campaigns and applications. */
export function WorkspaceLive(): ReactNode {
  const queryClient = useQueryClient();

  useSseChannel(workspaceChannel, null, {
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: campaignQueries.all });
      queryClient.invalidateQueries({ queryKey: applicationQueries.all });
    },
  });

  return null;
}
