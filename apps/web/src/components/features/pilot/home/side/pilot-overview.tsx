import type { ReactElement } from "react";
import { Divider, Stack } from "@mui/material";
import { BriefSummary } from "./brief-summary";
import { SourcesSection } from "./sources-section";
import { StealthCodeBanner } from "./stealth-code-banner";
import { WeekSummary } from "./week-summary";

/** How the week is going and what the pilot works from: under the queue, or its own phone tab. */
export function PilotOverview(): ReactElement {
  return (
    <Stack spacing={3} sx={{ px: 0.5 }}>
      <Stack spacing={3} divider={<Divider />}>
        <WeekSummary />
        <BriefSummary />
        <SourcesSection />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}
