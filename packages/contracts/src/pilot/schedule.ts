import { z } from "zod/v4";

/** Whether the runtime knows this IANA zone; an unknown one makes every later run time wrong. */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isTimeZone, { message: "Unknown IANA time zone." });

/** Offset from UTC, in ms, that `timeZone` was at `date` - DST included. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Some engines render midnight as hour 24; `% 24` puts it back on the same day.
  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour") % 24,
    at("minute"),
    at("second"),
  );
  return asIfUtc - date.getTime();
}

interface ZonedDate {
  year: number;
  month: number;
  day: number;
}

/** The calendar date `date` falls on inside `timeZone`. */
function zonedDate(date: Date, timeZone: string): ZonedDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: at("year"), month: at("month"), day: at("day") };
}

/**
 * The UTC instant of a wall-clock hour on a calendar date in `timeZone`.
 *
 * Corrects a UTC guess against the zone's offset at that guess. The offset only changes twice a
 * year, so one correction is exact everywhere except inside a DST gap, where the result lands on
 * the far side of the gap - which is what someone who picked "08:00" wants anyway.
 */
function zonedWallClockToUtc(date: ZonedDate, hour: number, timeZone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0);
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every `hours` slot on the zone-local days from `back` days ago through `ahead` days on. Walking
 * whole zone days rather than adding 24h keeps month ends and DST shifts correct for free.
 */
function dailySlots(
  hours: readonly number[],
  timeZone: string,
  now: Date,
  back: number,
  ahead: number,
): Date[] {
  const slots: Date[] = [];
  for (let offset = -back; offset <= ahead; offset++) {
    const day = zonedDate(new Date(now.getTime() + offset * DAY_MS), timeZone);
    for (const hour of hours) {
      slots.push(zonedWallClockToUtc(day, hour, timeZone));
    }
  }
  return slots;
}

/** The next instant any of `hours` strikes in `timeZone`, strictly after `now`; null with no hours. */
export function nextDailyRun(hours: readonly number[], timeZone: string, now: Date): Date | null {
  const upcoming = dailySlots(hours, timeZone, now, 0, 1).filter((at) => at > now);
  return upcoming.length > 0 ? new Date(Math.min(...upcoming.map((at) => at.getTime()))) : null;
}

/** The most recent instant any of `hours` struck in `timeZone`, at or before `now`; null with no hours. */
export function latestDailyRun(hours: readonly number[], timeZone: string, now: Date): Date | null {
  const past = dailySlots(hours, timeZone, now, 1, 0).filter((at) => at <= now);
  return past.length > 0 ? new Date(Math.max(...past.map((at) => at.getTime()))) : null;
}
