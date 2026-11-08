import type { ReactElement } from "react";
import { Divider, Stack } from "@mui/material";
import { BriefSummary } from "./brief-summary";
import { StealthCodeBanner } from "./stealth-code-banner";
import { WeekSummary } from "./week-summary";
import { WhereILook } from "./where-i-look";

/** How the week is going and what the pilot works from: under the queue, or its own phone tab. */
export function PilotOverview(): ReactElement {
  return (
    <Stack spacing={3} sx={{ px: 0.5 }}>
      <Stack spacing={3} divider={<Divider />}>
        <WeekSummary />
        <BriefSummary />
        <WhereILook />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}
