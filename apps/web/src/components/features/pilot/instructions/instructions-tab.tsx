"use client";

import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { InstructionsEditor } from "./instructions-editor";
import { PushSettings } from "./push-settings";

/** Instructions tab: the sectioned instructions editor plus notification settings. */
export function InstructionsTab(): ReactElement {
  // Same key as the Overview's state query; PilotLive keeps the shared cache fresh.
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });

  // PushSettings reads nothing from state, so it stays outside the gate and fetches in parallel.
  return (
    <Stack spacing={3}>
      {stateQuery.isLoading || !stateQuery.data ? (
        <Skeleton variant="rectangular" height={480} />
      ) : (
        <InstructionsEditor state={stateQuery.data} />
      )}
      <PushSettings />
    </Stack>
  );
}
