// Proactive/maintenance gathers through AgendaService.refresh (fake Prisma, no DB): promotion
// cadence, queue drain, board health, quiet-agenda candidates, and strategy bootstrap.

import { service } from "./compile.test-helpers";
import { approvedJob } from "./db.test-helpers";
import { describe, expect, it } from "bun:test";

describe("AgendaService promotion cadence", () => {
  const platformConfig = {
    promotion: { platforms: [{ platform: "hn", postEveryDays: 30 }] },
  };

  it("emits promo.compose for a platform whose cadence is due (no prior post)", async () => {
    const agenda = await service({ instructionsConfig: platformConfig }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "promo.compose")).toBe(true);
  });

  it("suppresses promo.compose while a recent non-declined post exists", async () => {
    const agenda = await service({
      instructionsConfig: platformConfig,
      platformPosts: [{ platform: "hn", createdAt: new Date() }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "promo.compose")).toBe(false);
  });
});

describe("AgendaService queue.drain", () => {
  it("emits a batch item from pending queue entries", async () => {
    const agenda = await service({
      pendingQueue: [{ id: "q1", url: "https://x/1" }],
      pendingQueueCount: 3,
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "queue.drain");
    expect(item?.payload).toEqual({
      entries: [{ id: "q1", url: "https://x/1" }],
      pendingCount: 3,
    });
  });

  it("emits no queue.drain when nothing is pending", async () => {
    const agenda = await service({}).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "queue.drain")).toBe(false);
  });
});

describe("AgendaService board.health", () => {
  // Newest-first apply outcomes for one board; a leading run of failures is the unhealthy signal.
  const failed = (key: string) => ({
    campaignId: "c1",
    key,
    url: `https://x/${key}`,
    board: "linkedin",
    status: "failed",
    failReason: "captcha wall",
  });
  const applied = (key: string) => ({ ...failed(key), status: "applied", failReason: null });

  it("flags a board with 3+ consecutive apply failures", async () => {
    const agenda = await service({
      boardHealthJobs: [failed("a"), failed("b"), failed("c")],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "board.health");
    expect(item?.subjectId).toBe("linkedin");
    expect(item?.payload).toMatchObject({
      board: "linkedin",
      consecutiveFailures: 3,
      probeJob: { campaignId: "c1", jobKey: "a", url: "https://x/a" },
    });
  });

  it("does not flag when a recent success breaks the failure streak", async () => {
    const agenda = await service({
      boardHealthJobs: [failed("a"), failed("b"), applied("c"), failed("d")],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "board.health")).toBe(false);
  });

  it("excludes a parked board from the health warning", async () => {
    const agenda = await service({
      instructionsConfig: { parkedBoards: ["linkedin"] },
      boardHealthJobs: [failed("a"), failed("b"), failed("c")],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "board.health")).toBe(false);
  });
});

describe("AgendaService quiet-agenda candidates", () => {
  // 40 found, 4 qualified (ratio 0.1 < 0.2), 36 skipped, 3 failed - trips every maintenance threshold.
  const laggard = {
    campaignId: "c1",
    query: "react",
    config: { minScore: 70, board: "linkedin" },
    source: "search",
  };

  it("emits strategyReview with counts and top skip reasons for a poorly-converting campaign", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      quietJobCounts: [
        { campaignId: "c1", status: "applied", _count: { _all: 1 } },
        { campaignId: "c1", status: "skipped", _count: { _all: 36 } },
        { campaignId: "c1", status: "failed", _count: { _all: 3 } },
      ],
      skipReasonRows: [{ campaignId: "c1", skipReason: "overqualified", _count: { _all: 20 } }],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "campaign.strategyReview");
    expect(item?.payload).toMatchObject({
      campaignId: "c1",
      config: { minScore: 70, board: "linkedin" },
      counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
      topSkipReasons: ["overqualified"],
    });
  });

  it("emits rescanSkipped and retryFailed from current job aggregates", async () => {
    const agenda = await service({ quietCampaigns: [laggard] }).refresh("p1");
    expect(agenda.items.find((i) => i.kind === "job.rescanSkipped")?.payload).toMatchObject({
      campaignId: "c1",
      skippedCount: 36,
    });
    expect(agenda.items.find((i) => i.kind === "job.retryFailed")?.payload).toMatchObject({
      campaignId: "c1",
      failedCount: 3,
    });
  });

  it("dedupes each maintenance kind against a marker journalled in the last 7 days", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      actionMarkers: [
        { subjectId: "c1", detail: { type: "strategyReview" } },
        { subjectId: "c1", detail: { type: "rescanSkipped" } },
        { subjectId: "c1", detail: { type: "retryFailed" } },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(false);
    expect(agenda.items.some((i) => i.kind === "job.rescanSkipped")).toBe(false);
    expect(agenda.items.some((i) => i.kind === "job.retryFailed")).toBe(false);
  });

  it("keeps candidates when the only markers are for unrelated subjects", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      actionMarkers: [{ subjectId: "other", detail: { type: "strategyReview" } }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(true);
  });
});

describe("AgendaService strategy.bootstrap", () => {
  it("emits the bootstrap item with the goals when none of the guards trip", async () => {
    const agenda = await service({
      instructionsConfig: { boards: ["linkedin"], minScore: 70 },
      instructionsGoals: "Senior TS roles, remote",
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "strategy.bootstrap");
    expect(item?.subjectType).toBe("pilot");
    expect(item?.subjectId).toBe("bootstrap");
    expect(item?.payload).toEqual({
      goals: "Senior TS roles, remote",
      hasGoals: true,
      boards: ["linkedin"],
      minScore: 70,
    });
  });

  it("marks hasGoals false when the goals are blank", async () => {
    const agenda = await service({ instructionsGoals: "   " }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "strategy.bootstrap");
    expect(item?.payload).toMatchObject({ goals: "", hasGoals: false });
  });

  it("suppresses bootstrap once a saved search exists", async () => {
    const agenda = await service({
      instructionsConfig: { savedSearches: [{ query: "react" }] },
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "strategy.bootstrap")).toBe(false);
  });

  it("suppresses bootstrap while its question is open", async () => {
    const agenda = await service({ pilotBootstrapQuestion: { id: "q1" } }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "strategy.bootstrap")).toBe(false);
  });

  it("suppresses bootstrap after a recent bootstrap claim", async () => {
    const agenda = await service({ bootstrapClaim: { id: "l1" } }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "strategy.bootstrap")).toBe(false);
  });

  it("suppresses bootstrap while the pipeline is busy", async () => {
    const agenda = await service({ approvedJobs: [approvedJob()] }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "strategy.bootstrap")).toBe(false);
  });
});
