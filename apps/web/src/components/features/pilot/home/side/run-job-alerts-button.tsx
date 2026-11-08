"use client";

import type { ReactElement } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { PlayArrow } from "@mui/icons-material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useCreateRequest } from "../../requests/use-create-request";
import { isRunning } from "../../run-status";

/** Why a run can't be asked for, or null when it can. */
function runDisabledReason(status: JobAlertsStatus): string | null {
  if (isRunning(status)) {
    return "An import is running.";
  }
  if (status.pendingEmails === 0) {
    return "No new job alert emails to import.";
  }
  return null;
}

interface RunJobAlertsButtonProps {
  status: JobAlertsStatus;
}

export function RunJobAlertsButton(props: RunJobAlertsButtonProps): ReactElement {
  const { status } = props;
  const request = useCreateRequest();
  const disabledReason = runDisabledReason(status);

  return (
    <TooltipIconButton
      title={disabledReason ?? "Import now"}
      size="small"
      disabled={disabledReason !== null || request.isPending}
      onClick={() => request.mutate({ taskType: "inbox.jobAlerts", payload: {} })}
      sx={{ mr: -0.5 }}
    >
      <PlayArrow fontSize="sm" />
    </TooltipIconButton>
  );
}
