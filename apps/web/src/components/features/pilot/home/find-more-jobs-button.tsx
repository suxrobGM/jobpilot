"use client";

import type { ReactElement } from "react";
import { TravelExplore } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { TooltipButton } from "@/components/ui/buttons";
import { useCreateRequest } from "../requests/use-create-request";
import { isRunning } from "../run-status";

export const WEB_SEARCH_HINT =
  "Searches the web beyond your boards: company career pages, university and lab portals.";

/** Asks for a web search now, instead of waiting for the weekly one. */
export function FindMoreJobsButton(): ReactElement {
  const status = useQuery(pilotQueries.research()).data;
  const request = useCreateRequest();
  const running = status !== undefined && isRunning(status);

  return (
    <TooltipButton
      title={running ? "A web search is already running." : WEB_SEARCH_HINT}
      size="small"
      color="inherit"
      startIcon={<TravelExplore fontSize="sm" />}
      disabled={running}
      loading={request.isPending}
      onClick={() => request.mutate({ taskType: "research.explore", payload: {} })}
    >
      Find more jobs
    </TooltipButton>
  );
}
