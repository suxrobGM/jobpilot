import { findTask, hasTaskType } from "./builders";
import { approvedJob, service } from "./fakes";
import { describe, expect, it } from "bun:test";

describe("TaskListService autopilot pause", () => {
  it("drops autonomous work while paused and expires the snapshot when a short pause ends", async () => {
    const pausedUntil = new Date(Date.now() + 60 * 1000);
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 90 })],
      autopilotPausedUntil: pausedUntil,
    }).refresh("p1");

    expect(hasTaskType(taskList, "job.apply")).toBe(false);
    expect(taskList.expiresAt.getTime()).toBe(pausedUntil.getTime());
  });

  it("keeps the normal snapshot lifetime when a long pause outlasts it", async () => {
    const before = Date.now();
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 90 })],
      autopilotPausedUntil: new Date(before + 60 * 60 * 1000),
    }).refresh("p1");

    expect(taskList.expiresAt.getTime()).toBeLessThan(before + 60 * 60 * 1000);
    expect(hasTaskType(taskList, "job.apply")).toBe(false);
  });

  it("runs autonomous work again once the pause has passed", async () => {
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 90 })],
      autopilotPausedUntil: new Date(Date.now() - 1000),
    }).refresh("p1");

    expect(findTask(taskList, "job.apply")).toBeDefined();
  });
});
