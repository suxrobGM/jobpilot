import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import { buildTaskList } from "./build";
import { base, findTask, job, research } from "./builders";
import { pilotSearchRow, service } from "./fakes";
import { researchTrigger } from "./gather-research";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-11-04T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const finished = (ms: number) => ({
  startedAt: ago(ms),
  finishedAt: ago(ms),
  outcome: "done" as const,
});
const trigger = (over: Partial<Parameters<typeof researchTrigger>[0]> = {}) =>
  researchTrigger({
    searchCount: 4,
    backingOffCount: 0,
    lastRun: finished(DAY_MS * 2),
    requestedAt: null,
    now: NOW,
    ...over,
  });

describe("researchTrigger", () => {
  it("fires initially, then holds for the week, then fires periodically", () => {
    expect(trigger({ lastRun: null })).toBe("initial");
    expect(trigger({ lastRun: finished(6 * DAY_MS) })).toBeNull();
    expect(trigger({ lastRun: finished(7 * DAY_MS) })).toBe("periodic");
  });

  it("lets a Research now request beat the damper, but not an open run", () => {
    expect(trigger({ requestedAt: ago(60_000), lastRun: finished(HOUR_MS) })).toBe("requested");
    const open = { startedAt: ago(30_000), finishedAt: null, outcome: null };
    expect(trigger({ requestedAt: ago(60_000), lastRun: open })).toBeNull();
  });

  it("fires dry only when more than half the searches back off, once a day", () => {
    expect(trigger({ backingOffCount: 2 })).toBeNull();
    expect(trigger({ backingOffCount: 3 })).toBe("dry");
    expect(trigger({ backingOffCount: 3, lastRun: finished(HOUR_MS) })).toBeNull();
  });

  it("never fires dry with zero searches", () => {
    expect(trigger({ searchCount: 0, backingOffCount: 0 })).toBeNull();
  });
});

describe("TaskListService research.explore", () => {
  const goals = "ML research assistant roles at US universities";
  const resumeId = "0f4b6a52-7c1e-4d8a-9b3f-2e5c6d7a8b90";

  it("offers research with the profile's preferences", async () => {
    const taskList = await service({
      instructionsGoals: goals,
      primaryResumeId: resumeId,
      profile: { requiresSponsorship: true, preferCapExempt: true },
      pilotSearches: [
        pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR_MS), lastRunAt: new Date() }),
      ],
    }).refresh("p1");
    expect(findTask(taskList, "research.explore")?.payload).toMatchObject({
      goals,
      resumeId,
      preferCapExempt: true,
      requiresSponsorship: true,
      trigger: "initial",
    });
  });

  it("stays out while the research campaign is paused", async () => {
    const taskList = await service({
      instructionsGoals: goals,
      primaryResumeId: resumeId,
      pausedFeeds: ["research"],
      researchRequestedAt: new Date(Date.now() - 60_000),
    }).refresh("p1");
    expect(findTask(taskList, "research.explore")).toBeUndefined();
  });
});

describe("buildTaskList research.explore", () => {
  it("waits for a quiet pipeline unless the user asked", () => {
    const busy = { approvedJobs: [job("j1", 80)] };
    expect(
      findTask(buildTaskList(base({ research: research("initial") })), "research.explore"),
    ).toBeDefined();
    const held = buildTaskList(base({ ...busy, research: research("periodic") }));
    expect(findTask(held, "research.explore")).toBeUndefined();
    const asked = buildTaskList(base({ ...busy, research: research("requested") }));
    expect(findTask(asked, "research.explore")?.payload).toMatchObject({
      trigger: "requested",
      newJobsTarget: 10,
    });
  });

  it("ranks a cap-exempt job above an equal match only with the preference on", () => {
    const approvedJobs = [job("plain", 80), job("exempt", 80, { capExemptBasis: "university" })];
    const firstKey = (preferCapExempt: boolean) =>
      buildTaskList(base({ approvedJobs, preferCapExempt })).tasks[0].payload;
    expect(firstKey(true)).toMatchObject({ jobKey: "exempt" });
    expect(firstKey(false)).toMatchObject({ jobKey: "plain" });
  });
});
