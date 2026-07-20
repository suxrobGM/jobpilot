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
      scored: 0,
      byStatus: {
        pending: 0,
        approved: 0,
        applying: 0,
        applied: 0,
        failed: 0,
        skipped: 0,
        needs_user: 0,
      },
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
      ...emptyJobSummary(),
      totalFound: 4,
      qualified: 3,
      applied: 1,
      failed: 1,
      skipped: 1,
      remaining: 1,
      byStatus: {
        ...emptyJobSummary().byStatus,
        approved: 1,
        applied: 1,
        failed: 1,
        skipped: 1,
      },
    });
  });

  // The roll-ups ship on the wire for the installed agent skills, but they are a projection of
  // byStatus; this pins that they cannot drift apart for any mix of statuses.
  it("keeps every roll-up consistent with byStatus", () => {
    const summary = summarizeJobs([
      { status: "pending" },
      { status: "pending" },
      { status: "approved" },
      { status: "applying" },
      { status: "applied" },
      { status: "applied" },
      { status: "failed" },
      { status: "skipped" },
      { status: "skipped" },
      { status: "needs_user" },
    ]);
    const c = summary.byStatus;

    expect(summary.totalFound).toBe(10);
    expect(summary.qualified).toBe(10 - c.skipped);
    expect(summary.applied).toBe(c.applied);
    expect(summary.failed).toBe(c.failed);
    expect(summary.skipped).toBe(c.skipped);
    expect(summary.remaining).toBe(c.approved + c.applying + c.needs_user);
  });
});
