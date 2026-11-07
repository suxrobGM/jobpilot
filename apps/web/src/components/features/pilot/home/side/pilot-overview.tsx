import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Divider, Stack } from "@mui/material";
import { RulesSummary } from "./rules-summary";
import { SearchesSummary } from "./searches-summary";
import { StealthCodeBanner } from "./stealth-code-banner";
import { WeekSummary } from "./week-summary";

interface PilotOverviewProps {
  state: PilotState;
}

/** How the week is going and what the pilot works from: under the queue, or its own phone tab. */
export function PilotOverview(props: PilotOverviewProps): ReactElement {
  const { state } = props;
  return (
    <Stack spacing={3} sx={{ px: 0.5 }}>
      <Stack spacing={3} divider={<Divider />}>
        <SearchesSummary />
        <RulesSummary state={state} />
        <WeekSummary />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}
