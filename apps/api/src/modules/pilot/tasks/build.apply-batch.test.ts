import type { PilotTask } from "@jobpilot/contracts/pilot";
import { buildTaskList } from "./build";
import { base, cfg, job } from "./builders";
import { describe, expect, it } from "bun:test";

const applyTasks = (tasks: PilotTask[]) =>
  tasks.filter((task) => task.taskType === "job.apply" || task.taskType === "job.applyBatch");

const batchKeys = (task: PilotTask | undefined) =>
  task?.taskType === "job.applyBatch" ? task.payload.jobs.map((entry) => entry.jobKey) : [];

const threeJobs = [
  job("j1", 90, { campaignId: "c1" }),
  job("j2", 80, { campaignId: "c2" }),
  job("j3", 70, { campaignId: "c3" }),
];

describe("buildTaskList apply batches", () => {
  it("keeps one task per job at the default of one concurrent apply", () => {
    const { tasks } = buildTaskList(base({ approvedJobs: threeJobs }));
    expect(applyTasks(tasks).map((task) => task.taskType)).toEqual([
      "job.apply",
      "job.apply",
      "job.apply",
    ]);
  });

  it("batches the best jobs up to the concurrency limit", () => {
    const config = cfg({ maxConcurrentApplies: 2 });
    const { tasks, budget } = buildTaskList(base({ config, approvedJobs: threeJobs }));
    const applies = applyTasks(tasks);
    expect(applies).toHaveLength(1);
    expect(batchKeys(applies[0])).toEqual(["j1", "j2"]);
    expect(applies[0].priority).toBe(890);
    expect(budget.maxConcurrentApplies).toBe(2);
  });

  it("shrinks the batch to the daily cap left, counting applies in flight", () => {
    const config = cfg({ maxConcurrentApplies: 3, dailyApplyCap: 5 });
    const input = base({ config, approvedJobs: threeJobs, appliedToday: 2, applyingNow: 1 });
    expect(batchKeys(applyTasks(buildTaskList(input).tasks)[0])).toEqual(["j1", "j2"]);
  });

  it("falls back to single applies when only one slot is free", () => {
    const config = cfg({ maxConcurrentApplies: 2 });
    const input = base({ config, approvedJobs: threeJobs, applyingNow: 1 });
    expect(applyTasks(buildTaskList(input).tasks).map((task) => task.taskType)).toEqual([
      "job.apply",
      "job.apply",
      "job.apply",
    ]);
  });

  it("takes only each campaign's best job, so no two browsers share a campaign", () => {
    const config = cfg({ maxConcurrentApplies: 3 });
    const approvedJobs = [
      job("a1", 95, { campaignId: "a" }),
      job("a2", 90, { campaignId: "a" }),
      job("b1", 85, { campaignId: "b" }),
      job("a3", 80, { campaignId: "a" }),
      job("c1", 70, { campaignId: "c" }),
    ];
    const { tasks } = buildTaskList(base({ config, approvedJobs }));
    expect(batchKeys(applyTasks(tasks)[0])).toEqual(["a1", "b1", "c1"]);
  });

  it("applies one at a time when every approved job is in the same campaign", () => {
    const config = cfg({ maxConcurrentApplies: 3 });
    const approvedJobs = [job("a1", 90, { campaignId: "a" }), job("a2", 80, { campaignId: "a" })];
    const { tasks } = buildTaskList(base({ config, approvedJobs }));
    expect(applyTasks(tasks).map((task) => task.taskType)).toEqual(["job.apply", "job.apply"]);
  });

  it("does not batch a single approved job", () => {
    const config = cfg({ maxConcurrentApplies: 3 });
    const { tasks } = buildTaskList(base({ config, approvedJobs: [job("j1", 90)] }));
    expect(applyTasks(tasks).map((task) => task.taskType)).toEqual(["job.apply"]);
  });
});
