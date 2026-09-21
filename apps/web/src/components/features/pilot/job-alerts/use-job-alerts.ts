import type { JobAlertsStatus, RunJobAlertsResult } from "@jobpilot/contracts/pilot";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useToast } from "@/providers/notification-provider";
import { plural } from "@/utils/format";

/** Poll fast only while a run is queued or in flight; otherwise the schedule barely moves. */
const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 120_000;

export function isActive(status: JobAlertsStatus | undefined): boolean {
  if (!status) return false;
  return (
    status.requestedAt !== null || (status.lastRun !== null && status.lastRun.outcome === null)
  );
}

/** Why a run can't be queued, or null when it can. */
export function runBlocker(status: JobAlertsStatus): string | null {
  if (!status.mailboxConnected)
    return "Connect Gmail in Settings → Email so there is mail to read.";
  if (!status.pilotRunning) return "Start the pilot - it is what does the harvesting.";
  return null;
}

/** The harvest status plus the mutation that queues a run for the pilot's next cycle. */
export function useJobAlerts() {
  const toast = useToast();
  const query = useApiQuery(pilotQueries.jobAlerts(), {
    refetchInterval: (current) => (isActive(current.state.data) ? ACTIVE_POLL_MS : IDLE_POLL_MS),
  });
  const run = useApiMutation<RunJobAlertsResult, void>(() => api.pilot["job-alerts"].run.post(), {
    invalidate: [queryKeys.pilot.jobAlerts(), queryKeys.pilot.agenda()],
    onSuccess: (result) => {
      if (!result.queued) {
        toast.info("No new job alert emails to harvest.");
        return;
      }
      toast.success(
        `Queued ${plural(result.pendingEmails, "alert email")} - the pilot picks it up on its next cycle.`,
      );
    },
  });

  return { query, status: query.data, run };
}
