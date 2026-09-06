"use client";

import type { ReactElement } from "react";
import { Skeleton } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { InstructionsEditor } from "./instructions-editor";

/** Instructions tab: the sectioned instructions editor. */
export function InstructionsTab(): ReactElement {
  // Same key as the Overview's state query; PilotLive keeps the shared cache fresh.
  const stateQuery = useApiQuery(pilotQueries.state(), {
    errorMessage: "Failed to load pilot state",
  });

  if (stateQuery.isLoading || !stateQuery.data) {
    return <Skeleton variant="rounded" height={480} />;
  }

  return <InstructionsEditor state={stateQuery.data} />;
}
