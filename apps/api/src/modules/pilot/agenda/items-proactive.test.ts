// Pure builder behavior for the M4 proactive kinds through buildAgenda: queue.drain emission + rank,
// board.health cap + rank, and quiet-agenda gating of strategyReview/rescan/retry. No Prisma, no env.
import { buildAgenda } from "./build";
import { base, boardHealth, cfg, job, strategyReview } from "./build.test-helpers";
import { describe, expect, it } from "bun:test";

describe("buildAgenda queue.drain", () => {
  it("emits one batch item carrying the entries and total pending count", () => {
    const agenda = buildAgenda(
      base({
        queue: {
          entries: [
            { id: "q1", url: "https://x/1" },
            { id: "q2", url: "https://x/2" },
          ],
          pendingCount: 7,
        },
      }),
    );
    const item = agenda.items.find((i) => i.kind === "queue.drain");
    expect(item?.id).toBe("queue.drain");
    expect(item?.subjectType).toBe("queue");
    expect(item?.priority).toBe(720);
    expect(item?.payload).toEqual({
      entries: [
        { id: "q1", url: "https://x/1" },
        { id: "q2", url: "https://x/2" },
      ],
      pendingCount: 7,
    });
  });

  it("emits no queue.drain when nothing is pending", () => {
    const agenda = buildAgenda(base({ queue: { entries: [], pendingCount: 0 } }));
    expect(agenda.items.some((i) => i.kind === "queue.drain")).toBe(false);
  });

  it("ranks queue.drain just below the scored apply queue", () => {
    const agenda = buildAgenda(
      base({
        approvedJobs: [job("j1", 90)],
        queue: { entries: [{ id: "q1", url: "https://x/1" }], pendingCount: 1 },
      }),
    );
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds.indexOf("job.apply")).toBeLessThan(kinds.indexOf("queue.drain"));
  });

  it("gates queue.drain behind active hours", () => {
    const agenda = buildAgenda(
      base({
        now: new Date("2026-07-15T03:00:00.000Z"),
        config: cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } }),
        queue: { entries: [{ id: "q1", url: "https://x/1" }], pendingCount: 1 },
      }),
    );
    expect(agenda.items.some((i) => i.kind === "queue.drain")).toBe(false);
  });
});

describe("buildAgenda board.health", () => {
  it("emits a warning ranked above even a top-scored job.apply, carrying the probe and reasons", () => {
    // board.health's 920 clears jobBase + matchScore (800 + 95): probe the board before piling on.
    const agenda = buildAgenda(
      base({ approvedJobs: [job("j1", 95)], boardHealth: [boardHealth("linkedin")] }),
    );
    const item = agenda.items.find((i) => i.kind === "board.health");
    expect(item?.subjectType).toBe("board");
    expect(item?.subjectId).toBe("linkedin");
    expect(item?.priority).toBe(920);
    expect(item?.payload).toMatchObject({ board: "linkedin", consecutiveFailures: 3 });
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds.indexOf("board.health")).toBeLessThan(kinds.indexOf("job.apply"));
  });

  it("emits at most one board.health per agenda", () => {
    const agenda = buildAgenda(
      base({ boardHealth: [boardHealth("linkedin"), boardHealth("indeed")] }),
    );
    expect(agenda.items.filter((i) => i.kind === "board.health")).toHaveLength(1);
  });
});

describe("buildAgenda quiet-agenda gating", () => {
  const quietWork = {
    strategyReviews: [strategyReview("c1")],
    rescanSkipped: [{ campaignId: "c1", skippedCount: 9 }],
    retryFailed: [{ campaignId: "c1", failedCount: 4 }],
  };

  it("surfaces strategyReview/rescan/retry on a quiet agenda", () => {
    const agenda = buildAgenda(base(quietWork));
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds).toContain("campaign.strategyReview");
    expect(kinds).toContain("job.rescanSkipped");
    expect(kinds).toContain("job.retryFailed");
  });

  it("orders the maintenance kinds strategyReview > rescanSkipped > retryFailed", () => {
    const kinds = buildAgenda(base(quietWork)).items.map((i) => i.kind);
    expect(kinds.indexOf("campaign.strategyReview")).toBeLessThan(
      kinds.indexOf("job.rescanSkipped"),
    );
    expect(kinds.indexOf("job.rescanSkipped")).toBeLessThan(kinds.indexOf("job.retryFailed"));
  });

  it("suppresses all maintenance kinds when job.apply work exists", () => {
    const agenda = buildAgenda(base({ ...quietWork, approvedJobs: [job("j1", 80)] }));
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds).not.toContain("campaign.strategyReview");
    expect(kinds).not.toContain("job.rescanSkipped");
    expect(kinds).not.toContain("job.retryFailed");
  });

  it("suppresses maintenance kinds when queue.drain work exists", () => {
    const agenda = buildAgenda(
      base({
        ...quietWork,
        queue: { entries: [{ id: "q1", url: "https://x/1" }], pendingCount: 1 },
      }),
    );
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(false);
  });

  it("suppresses maintenance kinds when search.discover work exists", () => {
    const agenda = buildAgenda(base({ ...quietWork, dueQueries: [{ query: "golang" }] }));
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(false);
  });

  it("emits at most one of each maintenance kind", () => {
    const agenda = buildAgenda(
      base({
        strategyReviews: [strategyReview("c1"), strategyReview("c2")],
        rescanSkipped: [
          { campaignId: "c1", skippedCount: 9 },
          { campaignId: "c2", skippedCount: 8 },
        ],
        retryFailed: [
          { campaignId: "c1", failedCount: 4 },
          { campaignId: "c2", failedCount: 3 },
        ],
      }),
    );
    expect(agenda.items.filter((i) => i.kind === "campaign.strategyReview")).toHaveLength(1);
    expect(agenda.items.filter((i) => i.kind === "job.rescanSkipped")).toHaveLength(1);
    expect(agenda.items.filter((i) => i.kind === "job.retryFailed")).toHaveLength(1);
  });

  it("carries the strategyReview counts and top skip reasons into the payload", () => {
    const item = buildAgenda(base(quietWork)).items.find(
      (i) => i.kind === "campaign.strategyReview",
    );
    expect(item?.payload).toMatchObject({
      campaignId: "c1",
      config: { minScore: 70, board: "linkedin" },
      counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
      topSkipReasons: ["overqualified"],
    });
  });

  it("gates maintenance kinds behind active hours", () => {
    const agenda = buildAgenda(
      base({
        ...quietWork,
        now: new Date("2026-07-15T03:00:00.000Z"),
        config: cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } }),
      }),
    );
    expect(agenda.items).toHaveLength(0);
  });
});
