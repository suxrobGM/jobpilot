import { HOUR_MS } from "@/common/date/buckets";
import { findTask } from "./builders";
import { approvedJob, pilotSearchRow, service } from "./fakes";
import { describe, expect, it } from "bun:test";

const dueRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() - HOUR_MS), ...over });
const futureRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR_MS), ...over });

const spentCap = { config: { dailyApplyCap: 5 }, appliedToday: 5 };

const findDiscover = (taskList: Parameters<typeof findTask>[0]) =>
  findTask(taskList, "search.discover");

describe("TaskListService search.discover", () => {
  it("offers a due search, keyed by its id", async () => {
    const taskList = await service({ pilotSearches: [dueRow({ id: "s-react" })] }).refresh("p1");
    const task = findDiscover(taskList);
    expect(task?.subjectId).toBe("s-react");
    expect(task?.payload).toMatchObject({ searchId: "s-react", query: "react", newJobsTarget: 10 });
  });

  it("waits on a search that is not due and ran recently", async () => {
    const taskList = await service({
      pilotSearches: [futureRow({ lastRunAt: new Date() })],
    }).refresh("p1");
    expect(findDiscover(taskList)).toBeUndefined();
  });

  it("runs an idle search early while the apply cap has room, and not once it is spent", async () => {
    const idle = await service({
      pilotSearches: [futureRow({ id: "s-idle", lastRunAt: null })],
    }).refresh("p1");
    expect(findDiscover(idle)?.subjectId).toBe("s-idle");

    const spent = await service({
      ...spentCap,
      pilotSearches: [futureRow({ lastRunAt: null })],
    }).refresh("p1");
    expect(findDiscover(spent)).toBeUndefined();
  });

  it("holds a search back while its last run is still open", async () => {
    const taskList = await service({
      pilotSearches: [dueRow({ id: "s-react" })],
      runs: {
        "search.discover": [{ subjectId: "s-react", startedAt: new Date(), finishedAt: null }],
      },
    }).refresh("p1");
    expect(findDiscover(taskList)).toBeUndefined();
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
      runs: { "search.discover": [run] },
    }).refresh("p1");
    expect(findDiscover(rewritten)?.subjectId).toBe("s-react");

    const unreported = await service({
      pilotSearches: [dueRow({ id: "s-react" })],
      runs: { "search.discover": [run] },
    }).refresh("p1");
    expect(findDiscover(unreported)).toBeUndefined();
  });
});

describe("TaskListService search.setup", () => {
  const findSetup = (taskList: Parameters<typeof findTask>[0]) =>
    findTask(taskList, "search.setup");

  it("starts from the resume when no search exists", async () => {
    const taskList = await service({ config: { minScore: 70 }, resumeCount: 1 }).refresh("p1");
    expect(findSetup(taskList)?.payload).toEqual({ minScore: 70, trigger: "auto" });
  });

  it("refills while the apply cap has room and every search is waiting", async () => {
    const taskList = await service({
      pilotSearches: [futureRow({ lastRunAt: new Date() })],
    }).refresh("p1");
    expect(findSetup(taskList)).toBeDefined();
  });

  it("stays out with nothing to start from, the cap spent, a try recent, or work queued", async () => {
    const blank = await service({}).refresh("p1");
    expect(findSetup(blank)).toBeUndefined();
    expect(blank.emptyReason).toBe("awaitingSetup");

    const cases = [
      { ...spentCap, pilotSearches: [futureRow({ lastRunAt: new Date() })] },
      { resumeCount: 1, latestRuns: { "search.setup": { finishedAt: null } } },
      { approvedJobs: [approvedJob()] },
    ];
    for (const over of cases) {
      const taskList = await service(over).refresh("p1");
      expect(findSetup(taskList)).toBeUndefined();
    }
  });
});
