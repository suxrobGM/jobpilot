"use client";

import type { ReactElement } from "react";
import { PlayArrow } from "@mui/icons-material";
import { Box, Button, type ButtonProps, Tooltip } from "@mui/material";
import { isActive, runBlocker, useJobAlerts } from "./use-job-alerts";

interface RunJobAlertsButtonProps {
  label: string;
  variant?: ButtonProps["variant"];
}

/** Queues a job-alert harvest; disabled, with the reason on hover, while one can't be queued. */
export function RunJobAlertsButton(props: RunJobAlertsButtonProps): ReactElement {
  const { label, variant = "contained" } = props;
  const { status, run } = useJobAlerts();

  const blocker = status ? runBlocker(status) : null;
  const active = isActive(status);
  const hint = blocker ?? (active ? "A harvest is already queued or running." : "");

  return (
    // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
    <Tooltip title={hint}>
      <Box component="span" sx={{ display: "inline-flex" }}>
        <Button
          size="small"
          variant={variant}
          startIcon={<PlayArrow />}
          // A queued or running harvest already covers the mail a second click would queue.
          disabled={!status || blocker !== null || active || run.isPending}
          onClick={() => run.mutate()}
        >
          {label}
        </Button>
      </Box>
    </Tooltip>
  );
}
