import type { ReactElement } from "react";
import { Divider, Stack } from "@mui/material";
import { GoalsSummary } from "./goals-summary";
import { RulesSummary } from "./rules-summary";
import { SearchesSummary } from "./searches-summary";
import { SourcesSummary } from "./sources-summary";
import { StealthCodeBanner } from "./stealth-code-banner";
import { WeekSummary } from "./week-summary";

/** How the week is going and what the pilot works from: under the queue, or its own phone tab. */
export function PilotOverview(): ReactElement {
  return (
    <Stack spacing={3} sx={{ px: 0.5 }}>
      <Stack spacing={3} divider={<Divider />}>
        <GoalsSummary />
        <SearchesSummary />
        <SourcesSummary />
        <RulesSummary />
        <WeekSummary />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}
