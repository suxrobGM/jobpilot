"use client";

import type { ReactElement } from "react";
import { Edit } from "@mui/icons-material";
import { Chip, Stack, Typography } from "@mui/material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useRotationNames } from "../../state/use-rotation-names";
import { OverviewSection } from "./overview-section";
import { SearchList } from "./search-list";
import { JobAlertsSource, ResearchSource } from "./source-rows";

/** The checked boards in rotation order. */
function BoardChips(): ReactElement {
  const names = useRotationNames();
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

/** Where the pilot finds jobs: boards, the searches it runs on them, alert emails, the web. */
export function SourcesSection(): ReactElement {
  return (
    <OverviewSection title="Sources" link={{ label: "Manage", href: "/pilot/searches" }}>
      <Stack spacing={1.5}>
        <BoardChips />
        <SearchList />
        <Stack spacing={0.25}>
          <JobAlertsSource />
          <ResearchSource />
        </Stack>
      </Stack>
    </OverviewSection>
  );
}
