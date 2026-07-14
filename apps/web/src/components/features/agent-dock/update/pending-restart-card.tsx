"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { LoadingSpinner } from "@/components/ui/feedback";
import type { PendingAction } from "../use-dock-health";

/** Spinner card shown instead of the offline card while an expected host restart is in flight. */
export function PendingRestartCard(props: { action: PendingAction }): ReactElement {
  return (
    <Stack spacing={1.5} sx={{ flex: 1, alignItems: "center", justifyContent: "center", p: 2 }}>
      <LoadingSpinner />
      <Typography variant="body2Muted">
        {props.action === "updating" ? "Updating the agent…" : "Starting the agent…"}
      </Typography>
    </Stack>
  );
}
