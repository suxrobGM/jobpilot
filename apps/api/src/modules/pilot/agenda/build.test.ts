// Pure agenda orchestrator: no Prisma, no env. Priority ordering, cap suppression, budget,
// empty-reason, and sleep rules against hand-built inputs.
import { buildAgenda } from "./build";
import {
  base,
  bootstrapCandidate,
  cfg,
  dueQuery,
  job,
  pausedCampaign,
  queueDrain,
} from "./build.test-helpers";
import { describe, expect, it } from "bun:test";

describe("buildAgenda priority", () => {
  it("orders question.answered above job.apply", () => {
    const agenda = buildAgenda(
      base({
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "Which start date?" }],
        approvedJobs: [job("j1", 80)],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["question.answered", "job.apply"]);
    expect(agenda.items[0].priority).toBeGreaterThan(agenda.items[1].priority);
  });

  it("orders question.answered above search.discover when the apply pipeline is empty", () => {
    const agenda = buildAgenda(
      base({
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "q" }],
        approvedJobs: [],
        dueQueries: [dueQuery("golang")],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["question.answered", "search.discover"]);
  });

  // Networking off throughout: a >=85 job also earns a warm intro, which says nothing about ranking.
  it("ranks job.apply items by matchScore descending", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "off" } }),
        approvedJobs: [job("low", 60), job("high", 95)],
      }),
    );
    expect(agenda.items.map((i) => i.subjectId)).toEqual(["high", "low"]);
  });

  it("moves discovery to the next configured board each cycle", () => {
    const boardAt = (cycleCount: number) =>
      buildAgenda(
        base({
          config: cfg({ boards: ["hiring.cafe", "linkedin.com", "indeed.com"] }),
          cycleCount,
          dueQueries: [dueQuery("golang")],
        }),
      ).items.find((i) => i.kind === "search.discover")?.payload.board;

    expect([0, 1, 2, 3].map(boardAt)).toEqual([
      "hiring.cafe",
      "linkedin.com",
      "indeed.com",
      "hiring.cafe",
    ]);
  });

  it("falls back to the search's own board when no boards are configured", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ boards: [] }),
        dueQueries: [dueQuery("golang", { board: "wellfound" })],
      }),
    );
    const discover = agenda.items.find((i) => i.kind === "search.discover");
    expect(discover?.payload.board).toBe("wellfound");
  });

  it("caps the agenda at 10 items", () => {
    const many = Array.from({ length: 15 }, (_, i) => job(`j${i}`, i));
    expect(buildAgenda(base({ approvedJobs: many })).items).toHaveLength(10);
  });

  it("suppresses discovery while approved jobs remain", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [job("j1", 80)], dueQueries: [dueQuery("golang")] }),
    );
    expect(agenda.items.some((i) => i.kind === "search.discover")).toBe(false);
  });
});

describe("buildAgenda campaign.scorePending", () => {
  const scorePending = (over: Record<string, unknown> = {}) => ({
    campaignId: "c1",
    query: "react",
    board: null,
    minScore: 60,
    pendingCount: 9,
    entries: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
    ...over,
  });

  it("emits scorePending on an empty apply pipeline, ranked above discovery", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [], scorePending: [scorePending()], dueQueries: [dueQuery("golang")] }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["campaign.scorePending", "search.discover"]);
    expect(agenda.items[0].priority).toBeGreaterThan(agenda.items[1].priority);
    expect(agenda.items[0].payload).toMatchObject({ campaignId: "c1", pendingCount: 9 });
  });

  it("suppresses scorePending while approved jobs remain", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [job("j1", 80)], scorePending: [scorePending()] }),
    );
    expect(agenda.items.some((i) => i.kind === "campaign.scorePending")).toBe(false);
  });

  it("marks the pipeline busy so quiet-agenda bootstrap is suppressed", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [], scorePending: [scorePending()], bootstrap: bootstrapCandidate() }),
    );
    expect(agenda.items.some((i) => i.kind === "campaign.scorePending")).toBe(true);
    expect(agenda.items.some((i) => i.kind === "strategy.bootstrap")).toBe(false);
  });
});

describe("buildAgenda campaign.reviewPaused", () => {
  it("ranks above a perfect-score apply and queue.drain, below board health and answered questions", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "off" } }),
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "q" }],
        approvedJobs: [job("j1", 100)],
        pausedCampaigns: [pausedCampaign("c9")],
        queueDrains: [queueDrain("c8")],
        boardHealth: [
          {
            board: "linkedin",
            consecutiveFailures: 3,
            recentFailReasons: ["captcha"],
            probeJob: null,
          },
        ],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "question.answered",
      "board.health",
      "campaign.reviewPaused",
      "job.apply",
      "queue.drain",
    ]);
  });

  it("emits at most one paused review per agenda", () => {
    const agenda = buildAgenda(
      base({ pausedCampaigns: [pausedCampaign("c1"), pausedCampaign("c2")] }),
    );
    expect(agenda.items.filter((i) => i.kind === "campaign.reviewPaused")).toHaveLength(1);
    expect(agenda.items[0].subjectId).toBe("c1");
  });

  it("still surfaces when the daily apply cap is reached", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ dailyApplyCap: 3, networking: { email: "off", linkedIn: "off" } }),
        appliedToday: 3,
        approvedJobs: [job("j1", 90)],
        pausedCampaigns: [pausedCampaign("c9")],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["campaign.reviewPaused"]);
  });

  it("survives the 10-item slice against a full apply pipeline", () => {
    const many = Array.from({ length: 15 }, (_, i) => job(`j${i}`, 85 + (i % 10)));
    const agenda = buildAgenda(
      base({ approvedJobs: many, pausedCampaigns: [pausedCampaign("c9")] }),
    );
    expect(agenda.items).toHaveLength(10);
    expect(agenda.items[0]).toMatchObject({
      id: "campaign.reviewPaused:c9",
      kind: "campaign.reviewPaused",
      subjectType: "campaign",
      subjectId: "c9",
      payload: { campaignId: "c9", query: "react", board: null },
    });
  });
});

describe("buildAgenda budget / cap", () => {
  it("suppresses job.apply and flags capReached once the daily cap is hit", () => {
    const agenda = buildAgenda(
      base({ config: cfg({ dailyApplyCap: 3 }), approvedJobs: [job("j1", 90)], appliedToday: 3 }),
    );
    expect(agenda.items.some((i) => i.kind === "job.apply")).toBe(false);
    expect(agenda.budget).toMatchObject({ dailyApplyCap: 3, appliedToday: 3, capReached: true });
    expect(agenda.budget.resetsAt).toBeInstanceOf(Date);
  });

  it("keeps job.apply while under the cap", () => {
    const agenda = buildAgenda(
      base({ config: cfg({ dailyApplyCap: 10 }), approvedJobs: [job("j1", 90)], appliedToday: 9 }),
    );
    expect(agenda.items.some((i) => i.kind === "job.apply")).toBe(true);
    expect(agenda.budget.capReached).toBe(false);
  });

  it("reports counts from the inputs", () => {
    const agenda = buildAgenda(
      base({ openQuestions: 2, activeClaims: 1, approvedJobs: [job("j1", 50)], appliedToday: 4 }),
    );
    expect(agenda.counts).toEqual({
      openQuestions: 2,
      activeClaims: 1,
      approvedJobs: 1,
      appliedToday: 4,
    });
  });
});

describe("buildAgenda emptyReason", () => {
  it("is null when the agenda has items", () => {
    expect(buildAgenda(base({ approvedJobs: [job("j1", 80)] })).emptyReason).toBeNull();
  });

  it("is capReached when empty and the daily cap is spent", () => {
    const agenda = buildAgenda(base({ config: cfg({ dailyApplyCap: 0 }) }));
    expect(agenda.emptyReason).toBe("capReached");
  });

  it("is awaitingSetup when empty and setup is unfinished", () => {
    expect(buildAgenda(base({ awaitingSetup: true })).emptyReason).toBe("awaitingSetup");
  });

  it("is clear when empty but searches and goals exist", () => {
    const agenda = buildAgenda(base({ awaitingSetup: false }));
    expect(agenda.emptyReason).toBe("clear");
  });
});

describe("buildAgenda sleep", () => {
  it("uses a short sleep when work is queued", () => {
    expect(buildAgenda(base({ approvedJobs: [job("j1", 80)] })).sleepSeconds).toBe(15);
  });

  it("uses the check interval when idle and no search is sooner", () => {
    const agenda = buildAgenda(base({ config: cfg({ checkIntervalMinutes: 30 }) }));
    expect(agenda.sleepSeconds).toBe(1800);
    expect(agenda.nextWakeAt).toEqual(new Date(agenda.generatedAt.getTime() + 1800 * 1000));
  });

  it("clamps the idle sleep down to the next search coming due", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ checkIntervalMinutes: 30 }),
        // 5 min out - sooner than the 30-min poll cadence, so the sleep shrinks to it.
        nextSearchRunAt: new Date(base().now.getTime() + 5 * 60 * 1000),
      }),
    );
    expect(agenda.sleepSeconds).toBe(300);
  });

  it("floors the idle sleep when a search is already overdue", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ checkIntervalMinutes: 30 }),
        nextSearchRunAt: new Date(base().now.getTime() - 60 * 1000),
      }),
    );
    expect(agenda.sleepSeconds).toBe(30);
  });
});
