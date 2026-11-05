import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

const stateRow = (over: Record<string, unknown>) => ({
  userId: "p1",
  autopilot: false,
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
  subjectType: string;
  subjectId: string;
  payload: unknown;
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
    campaignJob: { updateMany: count("jobsDropped") },
    application: { count: async () => 0 },
    networkingMessage: { count: async () => 0 },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { svc: new PilotService(db as unknown as PrismaClient), rec, runQueries, upserts };
}

describe("PilotService.getState", () => {
  it("reports the newest open, unexpired run as currentRun, or null", async () => {
    const startedAt = new Date();
    const run = {
      id: "r1",
      taskType: "upwork.syncInbox",
      subjectType: "upwork",
      subjectId: "inbox",
      payload: { lastSyncedAt: null, unreadCount: 0 },
      startedAt,
    };
    const { svc, runQueries } = stateService("", run);
    expect((await svc.getState("p1")).currentRun).toEqual({
      id: "r1",
      taskType: "upwork.syncInbox",
      title: "Pull the Upwork inbox",
      startedAt,
    });
    expect(runQueries[0]).toMatchObject({
      where: { userId: "p1", finishedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { startedAt: "desc" },
    });
    expect((await stateService("").svc.getState("p1")).currentRun).toBeNull();
  });
});

describe("PilotService.setAutopilot", () => {
  it("refuses to turn on without goals, but always turns off", async () => {
    await expect(stateService("   ").svc.setAutopilot("p1", true)).rejects.toMatchObject({
      status: 409,
    });
    expect((await stateService("").svc.setAutopilot("p1", false)).autopilot).toBe(false);
  });

  it("turns on once goals are written", async () => {
    const state = await stateService("ship senior frontend roles").svc.setAutopilot("p1", true);
    expect(state.autopilot).toBe(true);
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

  function activityService(state: { lastCycleAt: Date | null; nextWakeAt: Date | null } | null) {
    const noMax = { _max: { createdAt: null, updatedAt: null } };
    const db = {
      pilotRun: { findMany: async () => [] },
      pilotJournalEntry: { aggregate: async () => noMax },
      campaign: { aggregate: async () => noMax },
      campaignJob: { aggregate: async () => noMax },
      pilotState: { findUnique: async () => state },
    };
    return new PilotService(db as unknown as PrismaClient);
  }

  // A stuck-recovery cycle plans no wake but still reports when it completed.
  it.each([
    [new Date(completedAt.getTime() + 300_000), 300],
    [null, null],
  ])("reports the last cycle's planned sleep (wake %p)", async (nextWakeAt, sleepSeconds) => {
    const svc = activityService({ lastCycleAt: completedAt, nextWakeAt });
    expect((await svc.getActivity("p1")).lastCycle).toEqual({ completedAt, sleepSeconds });
  });

  it("reads a profile with no state row as never run", async () => {
    const activity = await activityService(null).getActivity("p1");
    expect(activity).toMatchObject({ lastCycle: null, lastActivityAt: null });
  });
});
