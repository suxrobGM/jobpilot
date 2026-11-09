import { bucketPerDay, minutesOfDay, nextDayReset, startOfDay } from "./buckets";
import { describe, expect, it } from "bun:test";

const iso = (d: Date): string => d.toISOString();

describe("startOfDay", () => {
  it("floors to UTC midnight regardless of the host timezone", () => {
    expect(iso(startOfDay(new Date("2026-06-14T23:59:59.999Z")))).toBe("2026-06-14T00:00:00.000Z");
    expect(iso(startOfDay(new Date("2026-06-14T00:00:00.000Z")))).toBe("2026-06-14T00:00:00.000Z");
  });
});

describe("nextDayReset", () => {
  it("returns the next UTC midnight", () => {
    expect(nextDayReset(new Date("2026-07-15T12:34:56.000Z"))).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });

  it("skips to the following midnight when now is exactly midnight", () => {
    expect(nextDayReset(new Date("2026-07-15T00:00:00.000Z"))).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });
});

describe("minutesOfDay", () => {
  it("counts minutes since UTC midnight", () => {
    expect(minutesOfDay(new Date("2026-07-15T07:30:59.000Z"))).toBe(7 * 60 + 30);
  });
});

describe("bucketPerDay", () => {
  const start = new Date("2026-06-01T00:00:00.000Z");

  it("zero-fills a chronological series of `days` UTC days", () => {
    const series = bucketPerDay([], start, 3);

    expect(series).toEqual([
      { date: new Date("2026-06-01T00:00:00.000Z"), count: 0 },
      { date: new Date("2026-06-02T00:00:00.000Z"), count: 0 },
      { date: new Date("2026-06-03T00:00:00.000Z"), count: 0 },
    ]);
  });

  it("counts each timestamp into its own UTC day", () => {
    const series = bucketPerDay(
      [
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-01T09:30:00.000Z"),
        new Date("2026-06-03T12:00:00.000Z"),
      ],
      start,
      3,
    );

    expect(series.map((p) => p.count)).toEqual([2, 0, 1]);
  });

  it("keeps a late-evening timestamp in its UTC day, not the next one", () => {
    // 23:00Z is the *following* local day east of Greenwich - local bucketing would land it on the 3rd.
    const series = bucketPerDay([new Date("2026-06-02T23:00:00.000Z")], start, 3);

    expect(series.map((p) => p.count)).toEqual([0, 1, 0]);
  });

  it("ignores timestamps outside the window", () => {
    const series = bucketPerDay(
      [new Date("2026-05-31T23:59:59.999Z"), new Date("2026-06-04T00:00:00.000Z")],
      start,
      3,
    );

    expect(series.map((p) => p.count)).toEqual([0, 0, 0]);
  });

  it("floors a `start` that is not already UTC midnight", () => {
    const series = bucketPerDay(
      [new Date("2026-06-01T08:00:00.000Z")],
      new Date("2026-06-01T17:45:12.000Z"),
      2,
    );

    expect(series[0]).toEqual({ date: new Date("2026-06-01T00:00:00.000Z"), count: 1 });
  });
});
