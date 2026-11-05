/** A run's hour on the schedule, e.g. 09:00. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

interface RunStatus {
  requestedAt: Date | null;
  lastRun: { outcome: string | null } | null;
}

/** Queued by Run now, or running. */
export function isRunPending(status: RunStatus): boolean {
  if (status.requestedAt !== null) {
    return true;
  }
  return status.lastRun !== null && status.lastRun.outcome === null;
}
