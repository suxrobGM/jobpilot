"use client";

import type { ReactNode } from "react";
import { TravelExplore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { useCreateRequest } from "../../requests/use-create-request";
import { isRunning } from "../../run-status";
import { SourceRow } from "./source-row";

function researchDetail(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (!lastRun) {
    return "Weekly, sooner when searches run dry";
  }
  if (lastRun.outcome === null) {
    return "Researching now";
  }
  const ago = `${formatRelativeTime(lastRun.startedAt)} ago`;
  return lastRun.summary ? `${ago}: ${lastRun.summary}` : `Last run ${ago}`;
}

/** The open-web search beyond the user's boards. */
export function ResearchSource(): ReactNode {
  const status = useQuery(pilotQueries.research()).data;
  const request = useCreateRequest();
  if (!status) {
    return null;
  }
  return (
    <SourceRow
      label="Open web"
      detail={researchDetail(status)}
      action={
        <Button
          size="small"
          startIcon={<TravelExplore />}
          disabled={isRunning(status)}
          loading={request.isPending}
          onClick={() => request.mutate({ taskType: "research.explore", payload: {} })}
        >
          Research
        </Button>
      }
    />
  );
}
