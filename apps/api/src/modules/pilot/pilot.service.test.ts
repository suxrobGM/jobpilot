import {
  pilotInstructionsChangeSchema,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

const stateRow = (over: Record<string, unknown>) => ({
  userId: "p1",
  running: false,
  instructionsGoals: "",
  instructionsConfig: {},
  instructionsUpdatedAt: new Date(),
  lastCycleAt: null,
  nextWakeAt: null,
  cycleCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

interface OpenRun {
  id: string;
  taskType: string;
  startedAt: Date;
}

function stateService(savedGoals: string, openRun: OpenRun | null = null, savedConfig = {}) {
  const rec = {
    searchResets: 0,
    searchDeletes: 0,
    setupRunDeletes: 0,
    campaignsCompleted: 0,
    jobsDropped: 0,
  };
  const runQueries: unknown[] = [];
  const upserts: { update: Record<string, unknown> }[] = [];
  const count = (key: keyof typeof rec) => async () => {
    rec[key]++;
    return { count: 1 };
  };
  const db = {
    pilotState: {
      findUnique: async () => ({ instructionsGoals: savedGoals, instructionsConfig: savedConfig }),
      upsert: async (a: { update: Record<string, unknown> }) => {
        upserts.push(a);
        return stateRow({ instructionsGoals: savedGoals, ...a.update });
      },
    },
    pilotSearch: { updateMany: count("searchResets"), deleteMany: count("searchDeletes") },
    pilotRun: {
      deleteMany: count("setupRunDeletes"),
      findFirst: async (args: unknown) => {
        runQueries.push(args);
        return openRun;
      },
    },
    campaign: {
      findMany: async () => [{ campaignId: "c1", source: "auto_apply" }],
      updateMany: count("campaignsCompleted"),
    },
    job: { updateMany: count("jobsDropped") },
    application: { count: async () => 0 },
    networkingMessage: { count: async () => 0 },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { svc: new PilotService(db as unknown as PrismaClient), rec, runQueries, upserts };
}

describe("PilotService.updateInstructions", () => {
  const body = (goals: string, onChange = {}) => ({
    goals,
    config: pilotInstructionsConfigSchema.omit({ jobAlerts: true }).parse({}),
    onChange: pilotInstructionsChangeSchema.parse(onChange),
  });

  it("makes every search due when the goals change, and retires nothing unasked", async () => {
    const { svc, rec } = stateService("old goals");
    await svc.updateInstructions("p1", body("new goals"));
    expect(rec).toEqual({
      searchResets: 1,
      searchDeletes: 0,
      setupRunDeletes: 0,
      campaignsCompleted: 0,
      jobsDropped: 0,
    });
  });

  it("leaves searches alone when the goals are unchanged", async () => {
    const { svc, rec } = stateService("same goals");
    await svc.updateInstructions("p1", body("same goals"));
    expect(rec.searchResets).toBe(0);
  });

  it("clears the setup damper with the searches, or the re-derive waits a day", async () => {
    const { svc, rec } = stateService("old goals");
    await svc.updateInstructions("p1", body("new goals", { rederiveSearches: true }));
    expect(rec).toMatchObject({ searchResets: 0, searchDeletes: 1, setupRunDeletes: 1 });
  });

  it("completes campaigns and drops the approved backlog when asked", async () => {
    const { svc, rec } = stateService("old goals");
    await svc.updateInstructions(
      "p1",
      body("new goals", { completeCampaigns: true, dropApprovedJobs: true }),
    );
    expect(rec).toMatchObject({ campaignsCompleted: 1, jobsDropped: 1 });
  });

  it("keeps the stored job-alert schedule, which only its own route edits", async () => {
    const jobAlerts = { enabled: true, runHours: [9], timeZone: "America/Detroit" };
    const { svc, upserts } = stateService("goals", null, { minScore: 80, jobAlerts });
    await svc.updateInstructions("p1", body("goals"));
    expect(upserts[0].update.instructionsConfig).toMatchObject({ minScore: 60, jobAlerts });
  });
});

describe("PilotService.getState", () => {
  it("reports the newest open, unexpired run as currentRun, or null", async () => {
    const run = { id: "r1", taskType: "job.apply", startedAt: new Date() };
    const { svc, runQueries } = stateService("", run);
    expect((await svc.getState("p1")).currentRun).toEqual(run);
    expect(runQueries[0]).toMatchObject({
      where: { userId: "p1", finishedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { startedAt: "desc" },
    });
    expect((await stateService("").svc.getState("p1")).currentRun).toBeNull();
  });
});

describe("PilotService.start", () => {
  it("refuses to start without goals, but always stops", async () => {
    await expect(stateService("   ").svc.start("p1")).rejects.toMatchObject({ status: 409 });
    expect((await stateService("").svc.stop("p1")).running).toBe(false);
  });

  it("starts once goals are written", async () => {
    const state = await stateService("ship senior frontend roles").svc.start("p1");
    expect(state.running).toBe(true);
  });
});

describe("PilotService.recordIdleCycle", () => {
  it("counts the check as a cycle and plans the next wake", async () => {
    const { svc } = stateService("goals");
    const before = Date.now();
    const state = await svc.recordIdleCycle("p1", { sleepSeconds: 1800 });
    expect(state.lastCycleAt).toBeInstanceOf(Date);
    expect(state.nextWakeAt?.getTime()).toBeGreaterThanOrEqual(before + 1_800_000);
  });
});

describe("PilotService.getActivity", () => {
  const completedAt = new Date("2026-07-20T12:00:00Z");

  function activityService(
    state: { running: boolean; lastCycleAt: Date | null; nextWakeAt: Date | null } | null,
  ) {
    const noMax = { _max: { createdAt: null, updatedAt: null } };
    const db = {
      pilotRun: { findMany: async () => [] },
      pilotJournalEntry: { aggregate: async () => noMax },
      campaign: { aggregate: async () => noMax },
      job: { aggregate: async () => noMax },
      pilotState: { findUnique: async () => state },
    };
    return new PilotService(db as unknown as PrismaClient);
  }

  // A stuck-recovery cycle plans no wake but still reports when it completed.
  it.each([
    [new Date(completedAt.getTime() + 300_000), 300],
    [null, null],
  ])("reports the last cycle's planned sleep (wake %p)", async (nextWakeAt, sleepSeconds) => {
    const svc = activityService({ running: true, lastCycleAt: completedAt, nextWakeAt });
    expect((await svc.getActivity("p1")).lastCycle).toEqual({ completedAt, sleepSeconds });
  });

  it("reads a profile with no state row as never run and stopped", async () => {
    const activity = await activityService(null).getActivity("p1");
    expect(activity).toMatchObject({ lastCycle: null, running: false, lastActivityAt: null });
    const idle = { running: true, lastCycleAt: null, nextWakeAt: null };
    expect(await activityService(idle).getActivity("p1")).toMatchObject({
      lastCycle: null,
      running: true,
    });
  });
});
