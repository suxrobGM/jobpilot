/**
 * Formats an ISO timestamp or Date as a compact relative age.
 *
 * Returns an empty string for invalid dates. Past timestamps are rounded to the
 * nearest second, minute, hour, day, or 30-day month and rendered with short
 * units such as `45s`, `12m`, `3h`, `8d`, or `2mo`.
 */
export function formatRelativeTime(value: string | Date): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
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
