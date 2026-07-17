"use client";

import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { InstructionsEditor } from "./instructions-editor";
import { PushSettings } from "./push-settings";

/** Instructions tab: the editor plus notification settings. Milestone 4 restructures the form. */
export function PilotInstructions(): ReactElement {
  // Same key as the Overview's state query; PilotLive keeps the shared cache fresh.
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });

  if (stateQuery.isLoading || !stateQuery.data) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rectangular" height={480} />
        <Skeleton variant="rectangular" height={140} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <InstructionsEditor state={stateQuery.data} />
      <PushSettings />
    </Stack>
  );
}
