/** Rounds a span to its largest whole unit: `45s`, `12m`, `3h`, `8d`, `2mo` (months are 30d). */
function formatSpan(diffMs: number): string {
  const diffSec = Math.max(1, Math.round(diffMs / 1000));
  if (diffSec < 60) {
    return `${diffSec}s`;
  }

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m`;
  }

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h`;
  }

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) {
    return `${diffDay}d`;
  }
  const diffMon = Math.round(diffDay / 30);
  return `${diffMon}mo`;
}

/** Compact age of a past timestamp, e.g. `12m`. Empty string for invalid dates. */
export function formatRelativeTime(value: string | Date): string {
  const then = new Date(value).getTime();
  return Number.isNaN(then) ? "" : formatSpan(Date.now() - then);
}

/** Compact countdown to a future timestamp, e.g. `3h`. Empty string for invalid dates. */
export function formatTimeUntil(value: string | Date): string {
  const target = new Date(value).getTime();
  return Number.isNaN(target) ? "" : formatSpan(target - Date.now());
}

/** Locale short date. Takes `Date | string` because Eden types `z.date()` fields as `Date`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

/** Locale month + day for a timeline bucket. UTC-pinned: the bucket is UTC midnight, which localises to the previous day west of Greenwich. */
export function formatDayBucket(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
