import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { useToast } from "@/providers/toast-provider";
import { plural } from "@/utils/format";

// Run events arrive over SSE (pilot-live.tsx); the poll only catches newly synced mail.
const POLL_MS = 120_000;

/** Why a run can't be queued, or null when it can. */
export function runDisabledReason(status: JobAlertsStatus): string | null {
  if (!status.mailboxConnected) {
    return "Connect Gmail in Settings → Email so there is mail to read.";
  }
  if (!status.pilotRunning) {
    return "Start the pilot - it is what does the importing.";
  }
  return null;
}

export function useJobAlerts() {
  const toast = useToast();
  const query = useQuery({ ...pilotQueries.jobAlerts(), refetchInterval: POLL_MS });
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

  return { query, status: query.data, run };
}
