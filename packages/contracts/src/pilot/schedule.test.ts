import { isTimeZone, latestDailyRun, nextDailyRun, timeZoneSchema } from "./schedule";
import { describe, expect, it } from "bun:test";

const NY = "America/New_York";

/** What the wall clock in `zone` reads at `date` - the assertion these tests actually care about. */
function wallClock(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

describe("time zones", () => {
  it("accepts IANA zones and rejects made-up ones", () => {
    expect(isTimeZone(NY)).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(timeZoneSchema.safeParse("Mars/Olympus").success).toBe(false);
  });
});

describe("daily runs", () => {
  // Wednesday 2026-09-02, 12:30 in New York (16:30Z).
  const now = new Date("2026-09-02T16:30:00Z");

  it("finds the next slot later today", () => {
    expect(wallClock(nextDailyRun([8, 17], NY, now)!, NY)).toBe("Wed, 09/02/2026, 17:00");
  });

  it("rolls the next slot to tomorrow once today's have passed", () => {
    expect(wallClock(nextDailyRun([8, 11], NY, now)!, NY)).toBe("Thu, 09/03/2026, 08:00");
  });

  it("finds the latest slot earlier today", () => {
    expect(wallClock(latestDailyRun([8, 17], NY, now)!, NY)).toBe("Wed, 09/02/2026, 08:00");
  });

  it("reaches back to yesterday before today's first slot", () => {
    const early = new Date("2026-09-02T10:00:00Z"); // 06:00 in New York
    expect(wallClock(latestDailyRun([8, 17], NY, early)!, NY)).toBe("Tue, 09/01/2026, 17:00");
  });

  it("counts a slot striking exactly now as passed", () => {
    const onTheHour = new Date("2026-09-02T12:00:00Z"); // 08:00 in New York
    expect(latestDailyRun([8], NY, onTheHour)!.getTime()).toBe(onTheHour.getTime());
  });

  it("keeps the wall-clock hour across a DST change", () => {
    // Sunday 2026-11-01, the day New York falls back; 07:00 local is after the change.
    const fallBack = new Date("2026-11-01T12:00:00Z");
    expect(wallClock(latestDailyRun([8], NY, fallBack)!, NY)).toBe("Sat, 10/31/2026, 08:00");
    expect(wallClock(nextDailyRun([8], NY, fallBack)!, NY)).toBe("Sun, 11/01/2026, 08:00");
  });

  it("returns null with no hours", () => {
    expect(nextDailyRun([], NY, now)).toBeNull();
    expect(latestDailyRun([], NY, now)).toBeNull();
  });
});
