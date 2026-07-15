import { atsSubject, boardSubject, subjectKeyForBoardEntry } from "./pilot.subjects";
import { describe, expect, it } from "bun:test";

describe("pilot subject keys", () => {
  it("builds frozen board and ats keys", () => {
    expect(boardSubject("linkedin.com")).toBe("board:linkedin.com");
    expect(atsSubject("greenhouse.io")).toBe("ats:greenhouse.io");
  });

  it("derives a board key from an observation entry's bare domain", () => {
    expect(subjectKeyForBoardEntry({ subjectType: "board", subjectId: "indeed.com" })).toBe(
      "board:indeed.com",
    );
  });

  it("returns null for a non-board or empty entry", () => {
    expect(subjectKeyForBoardEntry({ subjectType: "job", subjectId: "indeed.com" })).toBeNull();
    expect(subjectKeyForBoardEntry({ subjectType: "board", subjectId: null })).toBeNull();
  });
});
