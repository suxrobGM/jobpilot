/** The rolling window every timeline series in the app is drawn over. */
const DAYS_IN_TIMELINE = 30;

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** UTC, not server-local: a local day would re-bucket every user's activity if the server moved region. */
export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Midnight 6 days ago - "this week" is a rolling 7-day window, not a calendar week. */
export function startOfWeek(): Date {
  const d = startOfDay(new Date());
  d.setUTCDate(d.getUTCDate() - 6);
  return d;
}

export function startOfTimeline(): Date {
  const d = startOfDay(new Date());
  d.setUTCDate(d.getUTCDate() - (DAYS_IN_TIMELINE - 1));
  return d;
}

/** Next UTC midnight strictly after `now` - e.g. the daily apply budget's reset instant. */
export function nextDayReset(now: Date): Date {
  return new Date(startOfDay(now).getTime() + DAY_MS);
}

/** Minutes elapsed since UTC midnight for `now`. */
export function minutesOfDay(now: Date): number {
  return Math.floor((now.getTime() - startOfDay(now).getTime()) / 60_000);
}

/** Zero-filled day-by-day series of `days` days from `start`. Each `date` is UTC midnight, so clients must render it in UTC. */
export function bucketPerDay(
  dates: Date[],
  start: Date,
  days: number = DAYS_IN_TIMELINE,
): { date: Date; count: number }[] {
  // Keyed by epoch ms; Map keeps insertion order, so the series stays chronological.
  const counts = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const d = startOfDay(start);
    d.setUTCDate(d.getUTCDate() + i);
    counts.set(d.getTime(), 0);
  }
  for (const date of dates) {
    const key = startOfDay(date).getTime();
    const count = counts.get(key);
    if (count != null) {
      counts.set(key, count + 1);
    }
  }
  return Array.from(counts, ([ms, count]) => ({ date: new Date(ms), count }));
}
