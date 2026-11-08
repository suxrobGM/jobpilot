"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { usePilotState } from "../../use-pilot-state";
import { JobAlertsSource } from "./job-alerts-source";
import { ResearchSource } from "./research-source";
import { SideSection } from "./side-section";
import { SourceRow } from "./source-row";

function BoardsSource(): ReactElement {
  const rotation = usePilotState().config.boards;
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const names = rotation.map(
    (domain) => boards.find((board) => board.domain === domain)?.name ?? domain,
  );
  const detail = names.length > 0 ? names.join(" → ") : "None checked, so searches can't run";
  return (
    <SourceRow
      label="Job boards"
      detail={detail}
      action={
        <LinkButton size="small" href="/boards">
          Edit
        </LinkButton>
      }
    />
  );
}

/** Where the pilot finds jobs, each with a way to run it now. */
export function SourcesSummary(): ReactElement {
  return (
    <SideSection title="Sources">
      <Stack spacing={1.5}>
        <BoardsSource />
        <JobAlertsSource />
        <ResearchSource />
      </Stack>
    </SideSection>
  );
}
