import { shadowedJobIds } from "./shadowed-jobs";
import { describe, expect, it } from "bun:test";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 5, 9, minutes));

describe("shadowedJobIds", () => {
  it("keeps the most advanced copy of a posting and hides the rest", () => {
    const rows = [
      { id: "found", url: "u1", status: "pending" as const, updatedAt: at(30) },
      { id: "applied", url: "u1", status: "applied" as const, updatedAt: at(0) },
      { id: "skipped", url: "u1", status: "skipped" as const, updatedAt: at(45) },
      { id: "alone", url: "u2", status: "queued" as const, updatedAt: at(0) },
    ];
    expect(shadowedJobIds(rows).sort()).toEqual(["found", "skipped"]);
  });

  it("breaks a status tie by the newest update", () => {
    const rows = [
      { id: "older", url: "u1", status: "approved" as const, updatedAt: at(0) },
      { id: "newer", url: "u1", status: "approved" as const, updatedAt: at(5) },
    ];
    expect(shadowedJobIds(rows)).toEqual(["older"]);
  });
});
