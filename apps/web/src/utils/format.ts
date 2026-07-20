import { format, formatDistanceToNowStrict, isSameDay, type Locale } from "date-fns";

const COMPACT_UNIT: Record<string, string> = {
  xSeconds: "s",
  xMinutes: "m",
  xHours: "h",
  xDays: "d",
  xMonths: "mo",
  xYears: "y",
};

/** Minimal date-fns locale rendering strict-distance tokens as compact units ("3h") instead of words ("3 hours"). */
const compactLocale = {
  formatDistance: (token, count) => `${Math.max(1, count)}${COMPACT_UNIT[token] ?? ""}`,
} as Locale;

function compactDistance(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDistanceToNowStrict(date, { locale: compactLocale });
}

/** Compact age of a past timestamp, e.g. `12m`. Empty string for invalid dates. */
export function formatRelativeTime(value: string | Date): string {
  return compactDistance(value);
}

/** Compact countdown to a future timestamp, e.g. `3h`. Empty string for invalid dates. */
export function formatTimeUntil(value: string | Date): string {
  return compactDistance(value);
}

/** Human-readable date, e.g. `Jul 19, 2026`. Takes `Date | string` because Eden types `z.date()` fields as `Date`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM d, yyyy");
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

/** Absolute local timestamp with timezone, e.g. `Jul 19, 2026, 6:34 PM GMT+5`. Component options only - `dateStyle` + `timeZoneName` throws. */
export function formatAbsoluteTime(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  }).format(date);
}

// ISO timestamps WITH a UTC offset (Z or ±hh:mm) only - offset-less strings parse as local already.
const ISO_WITH_OFFSET = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g;

/** Replaces ISO timestamps embedded in free text with human-local times, e.g. agent log lines like "sleeping until 2026-07-19T18:34:43Z". */
export function humanizeIsoInText(text: string): string {
  return text.replace(ISO_WITH_OFFSET, (match) => {
    const date = new Date(match);
    if (Number.isNaN(date.getTime())) {
      return match;
    }
    return isSameDay(date, new Date()) ? format(date, "h:mm a") : format(date, "MMM d, h:mm a");
  });
}
