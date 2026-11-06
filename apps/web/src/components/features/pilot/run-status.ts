/** A run's hour on the schedule, e.g. 09:00. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

interface RunStatus {
  lastRun: { outcome: string | null } | null;
}

export function isRunning(status: RunStatus): boolean {
  return status.lastRun !== null && status.lastRun.outcome === null;
}
