"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";

export function DockTabEvents(): ReactElement {
  return (
    <Stack
      spacing={1}
      sx={(theme) => ({
        flex: 1,
        minHeight: 0,
        padding: theme.spacing(2.25),
        overflowY: "auto",
      })}
    >
      <Typography variant="overlineMuted">Live events</Typography>
      <Typography variant="body2Muted">
        Structured agent events stream here while a run is active.
      </Typography>
    </Stack>
  );
}
