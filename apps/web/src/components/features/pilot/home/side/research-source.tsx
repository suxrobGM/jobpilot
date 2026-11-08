"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { pipelineHref } from "@/utils/routes";
import { EdgeLinkButton } from "./edge-link-button";
import { SourceRow } from "./source-row";

const WEB_SEARCH_HINT =
  "Searches the web beyond your boards: company career pages, university and lab portals. Ask the pilot to find more jobs to run one now.";

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

/** When the web search last ran, and where its jobs landed. */
export function ResearchSource(): ReactNode {
  const status = useQuery(pilotQueries.research()).data;
  if (!status) {
    return null;
  }
  return (
    <SourceRow
      label="Web search"
      detail={researchDetail(status)}
      hint={WEB_SEARCH_HINT}
      action={status.feedId && <EdgeLinkButton label="View" href={pipelineHref(status.feedId)} />}
    />
  );
}
