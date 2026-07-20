import { emptyJobSummary, summarizeJobs } from "./campaign.summary";
import { describe, expect, it } from "bun:test";

describe("campaign summaries", () => {
  it("starts with a typed empty job summary", () => {
    expect(emptyJobSummary()).toEqual({
      kind: "jobs",
      totalFound: 0,
      qualified: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
    });
  });

  it("derives counts from current job rows", () => {
    expect(
      summarizeJobs([
        { status: "approved" },
        { status: "applied" },
        { status: "failed" },
        { status: "skipped" },
      ]),
    ).toEqual({
      kind: "jobs",
      totalFound: 4,
      qualified: 3,
      applied: 1,
      failed: 1,
      skipped: 1,
      remaining: 1,
    });
  });
});
