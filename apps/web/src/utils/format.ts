import { newTokens, type TokenUsage } from "@jobpilot/contracts/pilot";
import {
  format,
  formatDistanceStrict,
  formatDistanceToNowStrict,
  isSameDay,
  isThisYear,
  isToday,
  isYesterday,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";

const COMPACT_UNIT: Record<string, string> = {
  xSeconds: "s",
  xMinutes: "m",
  xHours: "h",
  xDays: "d",
  xMonths: "mo",
  xYears: "y",
};

/** Renders strict distances as "3h" rather than "3 hours". */
const compactLocale = {
  ...enUS,
  formatDistance: (token: string, count: number) =>
    `${Math.max(1, count)}${COMPACT_UNIT[token] ?? ""}`,
};

/** `3 jobs` / `1 job`. Pass `pluralWord` for anything an `s` does not cover. */
export function plural(count: number, word: string, pluralWord?: string): string {
  if (count === 1) {
    return `${count} ${word}`;
  }
  return `${count} ${pluralWord ?? `${word}s`}`;
}

/** Compact age of a past timestamp, e.g. `12m`. Empty string for invalid dates. */
export function formatRelativeTime(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDistanceToNowStrict(date, { locale: compactLocale });
}

/** A passed target returns `0s`: strict distance is unsigned and would read as time left. */
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

const countFormat = new Intl.NumberFormat("en-US");

/** Whole count with a fixed locale, so server and browser render the same digits. */
export function formatCount(count: number): string {
  return countFormat.format(count);
}

const tokenFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Compact token count, e.g. `950`, `12.3K`, `1.2M`. */
export function formatTokens(count: number): string {
  return tokenFormat.format(count);
}

/** New tokens with cache reads beside them, e.g. `184K new · 2.5M cached`. */
export function formatTokenSplit(usage: TokenUsage): string {
  return `${formatTokens(newTokens(usage))} new · ${formatTokens(usage.cacheRead)} cached`;
}

/** What new tokens are made of, e.g. `in 12K · out 41K · cache write 131K`. */
export function formatNewTokenParts(usage: TokenUsage): string {
  return [
    `in ${formatTokens(usage.input)}`,
    `out ${formatTokens(usage.output)}`,
    `cache write ${formatTokens(usage.cacheWrite)}`,
  ].join(" · ");
}

/** Locale date, e.g. `Jul 19, 2026`. Takes `Date` too because Eden types `z.date()` as `Date`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Pinned to UTC: a bucket is UTC midnight, which shows as the previous day west of Greenwich. */
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

/** E.g. `Jul 19, 2026, 6:34 PM GMT+5`. Component options only: `dateStyle` + `timeZoneName` throws. */
export function formatAbsoluteTime(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return absoluteTimeFormat.format(date);
}

// ISO timestamps WITH a UTC offset (Z or ±hh:mm) only - offset-less strings parse as local already.
const ISO_WITH_OFFSET = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g;

/** Rewrites ISO timestamps in free text, like agent log lines, as local times. */
export function humanizeIsoInText(text: string): string {
  return text.replace(ISO_WITH_OFFSET, (match) => {
    const date = new Date(match);
    if (Number.isNaN(date.getTime())) {
      return match;
    }
    return isSameDay(date, new Date()) ? format(date, "h:mm a") : format(date, "MMM d, h:mm a");
  });
}

/** "Today", "Yesterday", or the date, for day separators. */
export function formatDayLabel(date: Date): string {
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, isThisYear(date) ? "EEEE, MMM d" : "MMM d, yyyy");
}
