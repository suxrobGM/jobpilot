"use client";

import type { ReactElement } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { PlayArrow } from "@mui/icons-material";
import { TooltipButton } from "@/components/ui/buttons";
import { useCreateRequest } from "../../pilot/requests/use-create-request";
import { isRunning } from "../../pilot/run-status";

/** Why a run can't be asked for, or null when it can. */
function runDisabledReason(status: JobAlertsStatus): string | null {
  if (!status.mailboxConnected) {
    return "Connect Gmail in Settings → Email so there is mail to read.";
  }
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
    <TooltipButton
      title={disabledReason ?? ""}
      size="small"
      variant="contained"
      startIcon={<PlayArrow />}
      disabled={disabledReason !== null}
      loading={request.isPending}
      onClick={() => request.mutate({ taskType: "inbox.jobAlerts", payload: {} })}
    >
      Run now
    </TooltipButton>
  );
}
