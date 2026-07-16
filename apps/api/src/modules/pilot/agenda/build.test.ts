// Pure agenda orchestrator: no Prisma, no env. Priority ordering, cap suppression, active-hours
// gating, budget, and sleep rules against hand-built inputs.
import { buildAgenda } from "./build";
import { base, cfg, job } from "./build.test-helpers";
import { describe, expect, it } from "bun:test";

describe("buildAgenda priority", () => {
  it("orders question.answered above job.apply above campaign.finalize", () => {
    const agenda = buildAgenda(
      base({
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "Which start date?" }],
        approvedJobs: [job("j1", 80)],
        finalizeCampaigns: [{ campaignId: "c2", query: "react" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "question.answered",
      "job.apply",
      "campaign.finalize",
    ]);
    expect(agenda.items[0].priority).toBeGreaterThan(agenda.items[1].priority);
    expect(agenda.items[1].priority).toBeGreaterThan(agenda.items[2].priority);
  });

  it("orders question.answered above search.discover when the apply pipeline is empty", () => {
    const agenda = buildAgenda(
      base({
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "q" }],
        approvedJobs: [],
        dueQueries: [{ query: "golang" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["question.answered", "search.discover"]);
  });

  it("ranks job.apply items by matchScore descending", () => {
    const agenda = buildAgenda(base({ approvedJobs: [job("low", 60), job("high", 95)] }));
    expect(agenda.items.map((i) => i.subjectId)).toEqual(["high", "low"]);
  });

  it("caps the agenda at 10 items", () => {
    const many = Array.from({ length: 15 }, (_, i) => job(`j${i}`, i));
    expect(buildAgenda(base({ approvedJobs: many })).items).toHaveLength(10);
  });

  it("suppresses discovery while approved jobs remain", () => {
    const agenda = buildAgenda(
      base({ approvedJobs: [job("j1", 80)], dueQueries: [{ query: "golang" }] }),
    );
    expect(agenda.items.some((i) => i.kind === "search.discover")).toBe(false);
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
      base({ openQuestions: 2, activeLeases: 1, approvedJobs: [job("j1", 50)], appliedToday: 4 }),
    );
    expect(agenda.counts).toEqual({
      openQuestions: 2,
      activeLeases: 1,
      approvedJobs: 1,
      appliedToday: 4,
    });
  });
});

describe("buildAgenda active hours", () => {
  const hours = cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } });
  const OUTSIDE = new Date("2026-07-15T03:00:00.000Z");

  it("drops job.apply and discovery outside the window but keeps questions", () => {
    const agenda = buildAgenda(
      base({
        now: OUTSIDE,
        config: hours,
        answeredQuestions: [{ id: "e1", kind: "question", prompt: "q" }],
        approvedJobs: [job("j1", 90)],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["question.answered"]);
  });

  it("sleeps until the window opens when idle and outside hours", () => {
    const agenda = buildAgenda(base({ now: OUTSIDE, config: hours }));
    expect(agenda.items).toHaveLength(0);
    expect(agenda.sleepSeconds).toBe(6 * 60 * 60); // 03:00 -> 09:00
    expect(agenda.nextWakeAt).toEqual(new Date(OUTSIDE.getTime() + agenda.sleepSeconds * 1000));
  });
});

describe("buildAgenda sleep", () => {
  it("uses a short sleep when work is queued", () => {
    expect(buildAgenda(base({ approvedJobs: [job("j1", 80)] })).sleepSeconds).toBe(15);
  });

  it("uses the check interval when idle within hours", () => {
    expect(buildAgenda(base({ config: cfg({ checkIntervalMinutes: 30 }) })).sleepSeconds).toBe(
      1800,
    );
  });
});
