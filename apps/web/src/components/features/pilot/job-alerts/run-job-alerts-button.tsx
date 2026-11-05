"use client";

import type { ReactElement } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { PlayArrow } from "@mui/icons-material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipButton } from "@/components/ui/buttons";
import { useToast } from "@/providers/toast-provider";
import { plural } from "@/utils/format";
import { isRunPending } from "../run-status";

/** Why a run can't be queued, or null when it can. */
function runDisabledReason(status: JobAlertsStatus): string | null {
  if (!status.mailboxConnected) {
    return "Connect Gmail in Settings → Email so there is mail to read.";
  }
  if (!status.pilotRunning) {
    return "Start the pilot - it is what does the importing.";
  }
  return null;
}

interface RunJobAlertsButtonProps {
  status: JobAlertsStatus;
}

export function RunJobAlertsButton(props: RunJobAlertsButtonProps): ReactElement {
  const { status } = props;
  const toast = useToast();
  const run = useApiMutation(() => api.pilot["job-alerts"].runs.post(), {
    invalidate: [pilotQueries.jobAlerts().queryKey, pilotQueries.taskList().queryKey],
    onSuccess: (result) => {
      if (!result.queued) {
        toast.info("No new job alert emails to import.");
        return;
      }
      toast.success(
        `Queued ${plural(result.pendingEmails, "alert email")} - the pilot picks it up on its next cycle.`,
      );
    },
  });

  const disabledReason = runDisabledReason(status);
  const active = isRunPending(status);
  const hint = disabledReason ?? (active ? "An import is already queued or running." : "");

  return (
    <TooltipButton
      title={hint}
      size="small"
      variant="contained"
      startIcon={<PlayArrow />}
      disabled={disabledReason !== null || active}
      loading={run.isPending}
      onClick={() => run.mutate()}
    >
      Run now
    </TooltipButton>
  );
}
