"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { WEB_SEARCH_HINT } from "../find-more-jobs-button";
import { SourceRow } from "./source-row";

function researchDetail(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (!lastRun) {
    return "Weekly";
  }
  if (lastRun.outcome === null) {
    return "Searching now";
  }
  return `${formatRelativeTime(lastRun.startedAt)} ago`;
}

/** When the web search last ran; "Find more jobs" in the composer runs it now. */
export function ResearchSource(): ReactNode {
  const status = useQuery(pilotQueries.research()).data;
  if (!status) {
    return null;
  }
  return <SourceRow label="Web search" detail={researchDetail(status)} hint={WEB_SEARCH_HINT} />;
}
