"use client";

import type { ReactElement } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { PlayArrow } from "@mui/icons-material";
import { Box, Button, Tooltip } from "@mui/material";
import { isRunPending } from "./use-job-alerts";

interface RunJobAlertsButtonProps {
  status: JobAlertsStatus;
  disabledReason: string | null;
  submitting: boolean;
  onRun: () => void;
}

export function RunJobAlertsButton(props: RunJobAlertsButtonProps): ReactElement {
  const { status, disabledReason, submitting, onRun } = props;

  const active = isRunPending(status);
  const hint = disabledReason ?? (active ? "An import is already queued or running." : "");

  return (
    // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
    <Tooltip title={hint}>
      <Box component="span" sx={{ display: "inline-flex" }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<PlayArrow />}
          disabled={disabledReason !== null || active || submitting}
          onClick={onRun}
        >
          Run now
        </Button>
      </Box>
    </Tooltip>
  );
}
