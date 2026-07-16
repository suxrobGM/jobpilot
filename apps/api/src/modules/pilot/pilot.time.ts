import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { DAY_MS, startOfDay } from "@/common/date/buckets";

type ActiveHours = NonNullable<PilotInstructionsConfig["activeHours"]>;

// Intl.DateTimeFormat is immutable and its construction dominates this hot path (agenda polls
// every cycle), so cache one formatter per tz per shape.
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

function dayFormatter(tz: string): Intl.DateTimeFormat {
  let f = dayFormatters.get(tz);
  if (!f) {
    // en-CA yields YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(tz, f);
  }
  return f;
}

/** Milliseconds a wall-clock time in `tz` leads UTC at `date` (e.g. UTC+2 → +7_200_000). */
function tzOffsetMs(date: Date, tz: string): number {
  const p = Object.fromEntries(
    offsetFormatter(tz)
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    // 24h clock renders midnight as "24"; fold it back to 0.
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

/** UTC instant of the most recent `tz`-local midnight at or before `now`; UTC midnight when `tz` is absent. */
export function startOfDayInTz(now: Date, tz?: string): Date {
  if (!tz || tz === "UTC") {
    return startOfDay(now);
  }
  const dateParts = dayFormatter(tz).format(now);
  const [y, m, d] = dateParts.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

/** Next tz-local midnight strictly after `now` - the daily apply budget's reset instant. */
export function nextDayResetInTz(now: Date, tz?: string): Date {
  return new Date(startOfDayInTz(now, tz).getTime() + DAY_MS);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes elapsed since tz-local midnight for `now`. */
export function minutesOfDay(now: Date, tz?: string): number {
  return Math.floor((now.getTime() - startOfDayInTz(now, tz).getTime()) / 60_000);
}

/** Whether `now` falls inside the instructions' active window (always true when unset). Handles overnight windows. */
export function isWithinActiveHours(now: Date, hours?: ActiveHours): boolean {
  if (!hours) {
    return true;
  }
  const cur = minutesOfDay(now, hours.tz);
  const start = hhmmToMinutes(hours.start);
  const end = hhmmToMinutes(hours.end);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Seconds until the next window opens; 0 when already inside (or no window configured). */
export function secondsUntilNextWindow(now: Date, hours?: ActiveHours): number {
  if (!hours || isWithinActiveHours(now, hours)) {
    return 0;
  }
  const start = hhmmToMinutes(hours.start);
  const todayStart = startOfDayInTz(now, hours.tz).getTime() + start * 60_000;
  const target = todayStart > now.getTime() ? todayStart : todayStart + DAY_MS;
  return Math.ceil((target - now.getTime()) / 1000);
}
