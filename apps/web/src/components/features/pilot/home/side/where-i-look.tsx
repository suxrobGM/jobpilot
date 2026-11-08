"use client";

import type { ReactElement } from "react";
import { Edit } from "@mui/icons-material";
import { Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries } from "@/api/queries";
import { TooltipIconButton } from "@/components/ui/buttons";
import { usePilotState } from "../../use-pilot-state";
import { JobAlertsSource } from "./job-alerts-source";
import { ResearchSource } from "./research-source";
import { SearchList } from "./search-list";
import { SideSection } from "./side-section";

/** The checked boards in rotation order. */
function BoardChips(): ReactElement {
  const rotation = usePilotState().config.boards;
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const names = rotation.map(
    (domain) => boards.find((board) => board.domain === domain)?.name ?? domain,
  );
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Stack direction="row" sx={{ flex: 1, flexWrap: "wrap", gap: 0.5, minWidth: 0 }}>
        {names.map((name) => (
          <Chip key={name} label={name} size="small" variant="outlined" />
        ))}
        {names.length === 0 && (
          <Typography variant="body2" color="warning">
            No board checked, so searches can't run.
          </Typography>
        )}
      </Stack>
      <TooltipIconButton title="Edit boards" size="small" href="/boards" sx={{ mr: -0.5 }}>
        <Edit fontSize="sm" />
      </TooltipIconButton>
    </Stack>
  );
}

/** Where the pilot finds jobs: boards, the searches it runs on them, alert emails, the open web. */
export function WhereILook(): ReactElement {
  return (
    <SideSection title="Where I look" link={{ label: "Manage", href: "/pilot/goals" }}>
      <Stack spacing={1.5}>
        <BoardChips />
        <SearchList />
        <Stack spacing={0.25}>
          <JobAlertsSource />
          <ResearchSource />
        </Stack>
      </Stack>
    </SideSection>
  );
}
