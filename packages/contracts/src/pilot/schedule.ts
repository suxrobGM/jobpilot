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

interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localTime(date: Date, timeZone: string): LocalTime {
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
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  // Some engines render midnight as hour 24.
  return {
    year: at("year"),
    month: at("month"),
    day: at("day"),
    hour: at("hour") % 24,
    minute: at("minute"),
    second: at("second"),
  };
}

/** Offset from UTC, in ms, that `timeZone` was at `date`, DST included. */
function utcOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = localTime(date, timeZone);
  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime();
}

/** One offset correction is exact except inside a DST gap, where it lands past the gap. */
function localHourToUtc(date: LocalTime, hour: number, timeZone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0);
  return new Date(guess - utcOffsetMs(new Date(guess), timeZone));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Walks whole zone-local days, not 24h steps, so month ends and DST shifts stay correct. */
function dailyRunTimes(
  hours: readonly number[],
  timeZone: string,
  now: Date,
  back: number,
  ahead: number,
): Date[] {
  const runTimes: Date[] = [];
  for (let offset = -back; offset <= ahead; offset++) {
    const day = localTime(new Date(now.getTime() + offset * DAY_MS), timeZone);
    for (const hour of hours) {
      runTimes.push(localHourToUtc(day, hour, timeZone));
    }
  }
  return runTimes;
}

/** The next instant any of `hours` strikes in `timeZone`, strictly after `now`; null with no hours. */
export function nextDailyRun(hours: readonly number[], timeZone: string, now: Date): Date | null {
  const upcoming = dailyRunTimes(hours, timeZone, now, 0, 1).filter((at) => at > now);
  return upcoming.length > 0 ? new Date(Math.min(...upcoming.map((at) => at.getTime()))) : null;
}

/** The most recent instant any of `hours` struck in `timeZone`, at or before `now`; null with no hours. */
export function latestDailyRun(hours: readonly number[], timeZone: string, now: Date): Date | null {
  const past = dailyRunTimes(hours, timeZone, now, 1, 0).filter((at) => at <= now);
  return past.length > 0 ? new Date(Math.max(...past.map((at) => at.getTime()))) : null;
}
