// The next-search wake time in isolation - no database.

import { earliestSearchWake } from "./gather-searches";
import type { RunHistory } from "./run-history";
import { describe, expect, it } from "bun:test";

const HOUR_MS = 60 * 60 * 1000;
const now = new Date("2026-09-21T02:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);

function finished(hoursAgo: number, outcome: RunHistory["outcome"]): RunHistory {
  return { startedAt: at(-hoursAgo - 1), finishedAt: at(-hoursAgo), outcome };
}

function wake(searches: { id: string; nextRunAt: Date }[], runs: Record<string, RunHistory>) {
  return earliestSearchWake(searches, new Map(Object.entries(runs)));
}

describe("earliestSearchWake", () => {
  it("is the earliest nextRunAt when nothing is damped", () => {
    const searches = [
      { id: "a", nextRunAt: at(8) },
      { id: "b", nextRunAt: at(3) },
    ];
    expect(wake(searches, {})).toEqual(at(3));
  });

  it("waits for the cooldown on an overdue search instead of reporting it due now", () => {
    const searches = [
      { id: "overdue", nextRunAt: at(-80) },
      { id: "later", nextRunAt: at(7) },
    ];
    expect(wake(searches, { overdue: finished(1, "expired") })).toEqual(at(1));
  });

  it("reads as due now once the cooldown on an overdue search has lifted", () => {
    const result = wake([{ id: "overdue", nextRunAt: at(-80) }], {
      overdue: finished(3, "expired"),
    });
    expect(result).toEqual(at(-1));
  });

  it("keeps nextRunAt when it falls after the cooldown", () => {
    expect(wake([{ id: "a", nextRunAt: at(8) }], { a: finished(0.5, "done") })).toEqual(at(8));
  });

  it("skips a search whose run is still in flight", () => {
    const searches = [
      { id: "running", nextRunAt: at(-1) },
      { id: "later", nextRunAt: at(5) },
    ];
    const inFlight: RunHistory = { startedAt: at(-0.1), finishedAt: null, outcome: null };
    expect(wake(searches, { running: inFlight })).toEqual(at(5));
  });

  it("is null with no searches", () => {
    expect(wake([], {})).toBeNull();
  });
});
