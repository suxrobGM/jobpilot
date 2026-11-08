"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { PilotStateLoader } from "../../pilot/state/pilot-state-loader";
import { CycleCost } from "./cycle-cost";
import { JournalFeed } from "./journal-feed";
import { OrchestrationPanel } from "./orchestration-panel";

/** How the pilot works under the hood: the loop, its agents, token cost, and the raw journal. */
export function DiagnosticsView(): ReactElement {
  return (
    <PilotStateLoader heights={[220, 180, 320]}>
      {(state) => (
        <Stack spacing={3}>
          <OrchestrationPanel state={state} />
          <CycleCost />
          <JournalFeed />
        </Stack>
      )}
    </PilotStateLoader>
  );
}
