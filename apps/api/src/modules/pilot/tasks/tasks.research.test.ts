import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import { buildTaskList } from "./build";
import { base, cfg, findTask, job, research } from "./builders";
import { pilotSearchRow, service } from "./fakes";
import { researchTrigger } from "./gather/research";
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
    now: NOW,
    ...over,
  });

describe("researchTrigger", () => {
  it("fires initially, then holds for the week, then fires periodically", () => {
    expect(trigger({ lastRun: null })).toBe("initial");
    expect(trigger({ lastRun: finished(6 * DAY_MS) })).toBeNull();
    expect(trigger({ lastRun: finished(7 * DAY_MS) })).toBe("periodic");
  });

  it("holds while a research run is open", () => {
    expect(
      trigger({ lastRun: { startedAt: ago(30_000), finishedAt: null, outcome: null } }),
    ).toBeNull();
  });

  it("fires dry only when more than half the searches back off, once a day", () => {
    expect(trigger({ backingOffCount: 2 })).toBeNull();
    expect(trigger({ backingOffCount: 3 })).toBe("dry");
    expect(trigger({ backingOffCount: 3, lastRun: finished(HOUR_MS) })).toBeNull();
  });
});

describe("TaskListService research.explore", () => {
  const resumeId = "0f4b6a52-7c1e-4d8a-9b3f-2e5c6d7a8b90";

  it("offers research with the rules and the profile's sponsorship need", async () => {
    const taskList = await service({
      config: { preferCapExempt: true },
      primaryResumeId: resumeId,
      profile: { requiresSponsorship: true },
      pilotSearches: [
        pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR_MS), lastRunAt: new Date() }),
      ],
    }).refresh("p1");
    expect(findTask(taskList, "research.explore")?.payload).toMatchObject({
      resumeId,
      preferCapExempt: true,
      requiresSponsorship: true,
      trigger: "initial",
    });
  });

  it("stays out while the research feed is paused", async () => {
    const taskList = await service({
      primaryResumeId: resumeId,
      pausedFeeds: ["research"],
    }).refresh("p1");
    expect(findTask(taskList, "research.explore")).toBeUndefined();
  });
});

describe("buildTaskList research.explore", () => {
  it("waits for a quiet pipeline", () => {
    const busy = { approvedJobs: [job("j1", 80)] };
    expect(
      findTask(buildTaskList(base({ research: research("initial") })), "research.explore"),
    ).toBeDefined();
    const held = buildTaskList(base({ ...busy, research: research("periodic") }));
    expect(findTask(held, "research.explore")).toBeUndefined();
  });

  it("ranks a cap-exempt job above an equal match only with the preference on", () => {
    const approvedJobs = [job("plain", 80), job("exempt", 80, { capExemptBasis: "university" })];
    const firstKey = (preferCapExempt: boolean) =>
      buildTaskList(base({ approvedJobs, config: cfg({ preferCapExempt }) })).tasks[0].payload;
    expect(firstKey(true)).toMatchObject({ jobKey: "exempt" });
    expect(firstKey(false)).toMatchObject({ jobKey: "plain" });
  });
});
