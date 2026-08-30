import { format, formatDistanceStrict, formatDistanceToNowStrict, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";

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
  ...enUS,
  formatDistance: (token: string, count: number) =>
    `${Math.max(1, count)}${COMPACT_UNIT[token] ?? ""}`,
};

/** `3 jobs` / `1 job`. Pass `pluralWord` for anything an `s` does not cover. */
export function plural(count: number, word: string, pluralWord?: string): string {
  if (count === 1) return `${count} ${word}`;
  return `${count} ${pluralWord ?? `${word}s`}`;
}

/** Compact age of a past timestamp, e.g. `12m`. Empty string for invalid dates. */
export function formatRelativeTime(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDistanceToNowStrict(date, { locale: compactLocale });
}

/** Compact countdown to a future timestamp, e.g. `3h`. Strict distance is unsigned, so an already-passed target floors at `0s` rather than reading as time remaining. */
export function formatTimeUntil(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.getTime() <= Date.now() ? "0s" : formatRelativeTime(date);
}

/** Compact elapsed span between two timestamps, e.g. `1m 20s`. Empty string if either is invalid. */
export function formatSpanBetween(start: string | Date, end: string | Date): string {
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "";
  }
  return formatDistanceStrict(from, to, { locale: compactLocale });
}

/** Compact duration from a plain second count, e.g. `20m`. */
export function formatDuration(seconds: number): string {
  return formatSpanBetween(new Date(0), new Date(seconds * 1000));
}

/** Human-readable date in the viewer's locale, e.g. `Jul 19, 2026`. Takes `Date | string` because Eden types `z.date()` fields as `Date`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

// Constructing the formatter is the expensive half, and RelativeTime builds one per rendered row.
const absoluteTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZoneName: "short",
});

/** Absolute local timestamp with timezone, e.g. `Jul 19, 2026, 6:34 PM GMT+5`. Component options only - `dateStyle` + `timeZoneName` throws. */
export function formatAbsoluteTime(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return absoluteTimeFormat.format(date);
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
