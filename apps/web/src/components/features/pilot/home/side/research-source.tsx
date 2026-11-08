"use client";

import type { ReactNode } from "react";
import { TravelExplore } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { TooltipIconButton } from "@/components/ui/buttons";
import { formatRelativeTime } from "@/utils/format";
import { useCreateRequest } from "../../requests/use-create-request";
import { isRunning } from "../../run-status";
import { SourceRow } from "./source-row";

function researchDetail(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (!lastRun) {
    return "Weekly";
  }
  if (lastRun.outcome === null) {
    return "Researching now";
  }
  return `${formatRelativeTime(lastRun.startedAt)} ago`;
}

/** The open-web search beyond the user's boards. */
export function ResearchSource(): ReactNode {
  const status = useQuery(pilotQueries.research()).data;
  const request = useCreateRequest();
  if (!status) {
    return null;
  }
  const running = isRunning(status);
  return (
    <SourceRow
      label="Open web"
      detail={researchDetail(status)}
      action={
        <TooltipIconButton
          title={running ? "Research is running." : "Research now"}
          size="small"
          disabled={running || request.isPending}
          onClick={() => request.mutate({ taskType: "research.explore", payload: {} })}
          sx={{ mr: -0.5 }}
        >
          <TravelExplore fontSize="sm" />
        </TooltipIconButton>
      }
    />
  );
}
