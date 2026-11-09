import { dateSpan, parseResumeDate } from "./dates";
import { describe, expect, it } from "bun:test";

describe("parseResumeDate", () => {
  it("orders the formats a resume actually uses", () => {
    const jan2025 = parseResumeDate("Jan 2025");
    expect(jan2025).toBe(parseResumeDate("January 2025"));
    expect(jan2025).toBe(parseResumeDate("2025-01"));
    expect(parseResumeDate("2016")).toBeLessThan(jan2025!);
    expect(parseResumeDate("Present")).toBeGreaterThan(jan2025!);
  });

  it("returns null for text with no year so callers refuse instead of guessing", () => {
    for (const value of ["Summer", "", undefined, "recently"]) {
      expect(parseResumeDate(value)).toBeNull();
    }
  });
});

describe("dateSpan", () => {
  it("takes the earliest start and latest end rather than either entry's own range", () => {
    expect(
      dateSpan([
        { start: "Sep 2020", end: "Oct 2021" },
        { start: "Mar 2020", end: "Feb 2021" },
      ]),
    ).toEqual({ start: "Mar 2020", end: "Oct 2021" });
  });

  it("reports an open-ended span when no end parses, and refuses one with no start", () => {
    expect(dateSpan([{ start: "2024" }])).toEqual({ start: "2024", end: "Present" });
    expect(dateSpan([{ end: "2024" }])).toBeNull();
  });
});
