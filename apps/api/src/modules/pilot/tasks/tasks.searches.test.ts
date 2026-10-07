import { HOUR_MS } from "@/common/date/buckets";
import { findTask } from "./builders";
import { approvedJob, pilotSearchRow, service } from "./fakes";
import { describe, expect, it } from "bun:test";

const dueRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() - HOUR_MS), ...over });
const futureRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR_MS), ...over });

const spentCap = { instructionsConfig: { dailyApplyCap: 5 }, appliedToday: 5 };

const discoverOf = (taskList: Parameters<typeof findTask>[0]) =>
  findTask(taskList, "search.discover");

describe("TaskListService search.discover", () => {
  it("offers a due search, keyed by its id", async () => {
    const taskList = await service({ pilotSearches: [dueRow({ id: "s-react" })] }).refresh("p1");
    const task = discoverOf(taskList);
    expect(task?.subjectId).toBe("s-react");
    expect(task?.payload).toMatchObject({ searchId: "s-react", query: "react", newJobsTarget: 10 });
  });

  it("waits on a search that is not due and ran recently", async () => {
    const taskList = await service({
      pilotSearches: [futureRow({ lastRunAt: new Date() })],
    }).refresh("p1");
    expect(discoverOf(taskList)).toBeUndefined();
  });

  it("runs an idle search early while the apply cap has room, and not once it is spent", async () => {
    const hungry = await service({
      pilotSearches: [futureRow({ id: "s-hungry", lastRunAt: null })],
    }).refresh("p1");
    expect(discoverOf(hungry)?.subjectId).toBe("s-hungry");

    const spent = await service({
      ...spentCap,
      pilotSearches: [futureRow({ lastRunAt: null })],
    }).refresh("p1");
    expect(discoverOf(spent)).toBeUndefined();
  });

  it("holds a search back while its last run is still open", async () => {
    const taskList = await service({
      pilotSearches: [dueRow({ id: "s-react" })],
      searchRuns: [{ subjectId: "s-react", startedAt: new Date(), finishedAt: null }],
    }).refresh("p1");
    expect(discoverOf(taskList)).toBeUndefined();
  });

  it("reruns a search rescheduled after its last run, and holds one nothing rescheduled", async () => {
    const run = {
      subjectId: "s-react",
      startedAt: new Date(Date.now() - 10 * 60_000),
      finishedAt: new Date(Date.now() - 5 * 60_000),
      outcome: "done",
    };
    const rewritten = await service({
      pilotSearches: [dueRow({ id: "s-react", nextRunAt: new Date(Date.now() - 60_000) })],
      searchRuns: [run],
    }).refresh("p1");
    expect(discoverOf(rewritten)?.subjectId).toBe("s-react");

    const unreported = await service({
      pilotSearches: [dueRow({ id: "s-react" })],
      searchRuns: [run],
    }).refresh("p1");
    expect(discoverOf(unreported)).toBeUndefined();
  });

  it("reuses the newest campaign the search spawned, whatever its query is now", async () => {
    const taskList = await service({
      pilotSearches: [dueRow({ id: "s1", query: "senior react" })],
      dueSearchCampaigns: [
        { campaignId: "c-old", pilotSearchId: "s1" },
        { campaignId: "c-new", pilotSearchId: "s1" },
      ],
    }).refresh("p1");
    expect(discoverOf(taskList)?.payload).toMatchObject({ campaignId: "c-new" });

    const fresh = await service({ pilotSearches: [dueRow()] }).refresh("p1");
    expect(discoverOf(fresh)?.payload).toMatchObject({ campaignId: undefined });
  });
});

describe("TaskListService search.setup", () => {
  const goals = "Senior TS roles, remote";
  const setupOf = (taskList: Parameters<typeof findTask>[0]) => findTask(taskList, "search.setup");

  it("derives searches from the goals when none exist", async () => {
    const taskList = await service({
      instructionsConfig: { minScore: 70 },
      instructionsGoals: `  ${goals} `,
    }).refresh("p1");
    expect(setupOf(taskList)?.payload).toEqual({ goals, minScore: 70 });
  });

  it("refills while the apply cap has room and every search is waiting", async () => {
    const taskList = await service({
      instructionsGoals: goals,
      pilotSearches: [futureRow({ lastRunAt: new Date() })],
    }).refresh("p1");
    expect(setupOf(taskList)).toBeDefined();
  });

  it("stays out when goals are blank, the cap is spent, a try is recent, or work is queued", async () => {
    const blank = await service({ instructionsGoals: "   " }).refresh("p1");
    expect(setupOf(blank)).toBeUndefined();
    expect(blank.emptyReason).toBe("awaitingSetup");

    const cases = [
      { ...spentCap, pilotSearches: [futureRow({ lastRunAt: new Date() })] },
      { setupRun: { finishedAt: null } },
      { approvedJobs: [approvedJob()] },
    ];
    for (const over of cases) {
      const taskList = await service({ instructionsGoals: goals, ...over }).refresh("p1");
      expect(setupOf(taskList)).toBeUndefined();
    }
  });
});
