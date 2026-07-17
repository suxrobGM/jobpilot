// DST-sensitive tz math, pure (no Prisma, no env). Next-midnight derivation must re-anchor via
// startOfDayInTz instead of adding 24h - DST transition days are 23/25h long.
import { nextDayResetInTz, secondsUntilNextWindow } from "./pilot.time";
import { describe, expect, it } from "bun:test";

const NY = "America/New_York";

describe("nextDayResetInTz", () => {
  it("returns the next UTC midnight when tz is absent", () => {
    expect(nextDayResetInTz(new Date("2026-07-15T12:34:56.000Z"))).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });

  it("lands on the next local midnight across the 23h spring-forward day (NY 2026-03-08)", () => {
    // Local midnight is 05:00Z (EST); the next one is only 23h later at 04:00Z (EDT).
    expect(nextDayResetInTz(new Date("2026-03-08T12:00:00.000Z"), NY)).toEqual(
      new Date("2026-03-09T04:00:00.000Z"),
    );
  });

  it("lands on the next local midnight across the 25h fall-back day (NY 2026-11-01)", () => {
    // Local midnight is 04:00Z (EDT); the next one is 25h later at 05:00Z (EST).
    expect(nextDayResetInTz(new Date("2026-11-01T12:00:00.000Z"), NY)).toEqual(
      new Date("2026-11-02T05:00:00.000Z"),
    );
  });
});

describe("secondsUntilNextWindow across DST", () => {
  const hours = { start: "09:00", end: "17:00", tz: NY };

  it("targets tomorrow 09:00 EDT from spring-forward evening", () => {
    // 23:00Z = 19:00 EDT on 2026-03-08; next open is 2026-03-09T13:00Z (09:00 EDT), 14h away.
    expect(secondsUntilNextWindow(new Date("2026-03-08T23:00:00.000Z"), hours)).toBe(14 * 3600);
  });

  it("targets tomorrow 09:00 EST from fall-back evening", () => {
    // 23:00Z = 18:00 EST on 2026-11-01; next open is 2026-11-02T14:00Z (09:00 EST), 15h away.
    expect(secondsUntilNextWindow(new Date("2026-11-01T23:00:00.000Z"), hours)).toBe(15 * 3600);
  });
});
