// Pure agenda builder: no Prisma, no env. Exercises priority ordering, cap suppression,
// active-hours gating, budget, and sleep rules against hand-built inputs.
import { type PilotMandateConfig, pilotMandateConfigSchema } from "@jobpilot/contracts/pilot";
import { type AgendaInput, buildAgenda } from "./agenda.build";
import { describe, expect, it } from "bun:test";

const cfg = (over: Record<string, unknown> = {}): PilotMandateConfig =>
  pilotMandateConfigSchema.parse(over);

const NOW = new Date("2026-07-15T12:00:00.000Z"); // noon UTC, inside a 09-17 window

const base = (over: Partial<AgendaInput> = {}): AgendaInput => ({
  now: NOW,
  config: cfg(),
  openEscalations: 0,
  answeredEscalations: [],
  activeLeases: 0,
  approvedJobs: [],
  appliedToday: 0,
  dueQueries: [],
  finalizeCampaigns: [],
  ...over,
});

const job = (key: string, matchScore: number | null) => ({
  campaignId: "c1",
  key,
  title: `Job ${key}`,
  url: `https://x/${key}`,
  board: null,
  digest: null,
  matchScore,
});

describe("buildAgenda priority", () => {
  it("orders escalation.answered above job.apply above campaign.finalize", () => {
    const agenda = buildAgenda(
      base({
        answeredEscalations: [{ id: "e1", kind: "question", question: "Which start date?" }],
        approvedJobs: [job("j1", 80)],
        finalizeCampaigns: [{ campaignId: "c2", query: "react" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "escalation.answered",
      "job.apply",
      "campaign.finalize",
    ]);
    expect(agenda.items[0].priority).toBeGreaterThan(agenda.items[1].priority);
    expect(agenda.items[1].priority).toBeGreaterThan(agenda.items[2].priority);
  });

  it("orders escalation.answered above search.discover when the apply pipeline is empty", () => {
    const agenda = buildAgenda(
      base({
        answeredEscalations: [{ id: "e1", kind: "question", question: "q" }],
        approvedJobs: [],
        dueQueries: [{ query: "golang" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["escalation.answered", "search.discover"]);
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
      base({ openEscalations: 2, activeLeases: 1, approvedJobs: [job("j1", 50)], appliedToday: 4 }),
    );
    expect(agenda.counts).toEqual({
      openEscalations: 2,
      activeLeases: 1,
      approvedJobs: 1,
      appliedToday: 4,
    });
  });
});

describe("buildAgenda active hours", () => {
  const hours = cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } });
  const OUTSIDE = new Date("2026-07-15T03:00:00.000Z");

  it("drops job.apply and discovery outside the window but keeps escalations", () => {
    const agenda = buildAgenda(
      base({
        now: OUTSIDE,
        config: hours,
        answeredEscalations: [{ id: "e1", kind: "question", question: "q" }],
        approvedJobs: [job("j1", 90)],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["escalation.answered"]);
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
