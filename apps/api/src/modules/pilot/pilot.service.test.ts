import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

const stateRow = (over: Record<string, unknown>) => ({
  userId: "p1",
  autopilot: false,
  config: {},
  lastCycleAt: null,
  nextWakeAt: null,
  cycleCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const LINKED = ["linkedin.com", "hiringcafe.com"];

interface OpenRun {
  id: string;
  taskType: string;
  title: string;
  startedAt: Date;
}

function stateService(openRun: OpenRun | null = null, savedConfig = {}) {
  const rec = {
    searchResets: 0,
    searchDeletes: 0,
    setupRunDeletes: 0,
    feedsCompleted: 0,
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
      findUnique: async () => ({ config: savedConfig }),
      upsert: async (a: { update: Record<string, unknown> }) => {
        upserts.push(a);
        return stateRow(a.update);
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
    feed: {
      findMany: async () => [{ feedId: "c1", source: "auto_apply" }],
      updateMany: count("feedsCompleted"),
    },
    job: { updateMany: count("jobsDropped") },
    application: { count: async () => 0 },
    networkingMessage: { count: async () => 0 },
    userJobBoard: { findMany: async () => LINKED.map((domain) => ({ board: { domain } })) },
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
      title: "Pull the Upwork inbox",
      startedAt,
    };
    const { svc, runQueries } = stateService(run);
    expect((await svc.getState("p1")).currentRun).toEqual(run);
    expect(runQueries[0]).toMatchObject({
      where: { userId: "p1", finishedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { startedAt: "desc" },
    });
    expect((await stateService().svc.getState("p1")).currentRun).toBeNull();
  });
});

describe("PilotService.setAutopilot", () => {
  it("stamps the start time when turned on", async () => {
    const { svc, upserts } = stateService();
    const state = await svc.setAutopilot("p1", true);
    expect(state.autopilot).toBe(true);
    expect(upserts[0].update.autopilotSince).toBeInstanceOf(Date);
  });

  // `cap.unused` counts a week from the start; turning off clears it.
  it("clears the start time when turned off", async () => {
    const { svc, upserts } = stateService();
    await svc.setAutopilot("p1", false);
    expect(upserts[0].update.autopilotSince).toBeNull();
  });
});

describe("PilotService.recordCycle", () => {
  it("counts the check as a cycle and plans the next wake", async () => {
    const { svc } = stateService();
    const before = Date.now();
    const state = await svc.recordCycle("p1", { sleepSeconds: 1800 });
    expect(state.lastCycleAt).toBeInstanceOf(Date);
    expect(state.nextWakeAt?.getTime()).toBeGreaterThanOrEqual(before + 1_800_000);
  });
});

describe("PilotService.updateSettings", () => {
  it("stores the rotation as linked board domains, folding aliases and repeats", async () => {
    const { svc, upserts } = stateService();
    await svc.updateSettings("p1", {
      boards: ["https://hiring.cafe/", "LinkedIn.com", "hiringcafe.com"],
    });
    expect(upserts[0].update.config).toMatchObject({ boards: ["hiringcafe.com", "linkedin.com"] });
  });

  it("refuses a board the user hasn't linked, since the searcher can't open it", async () => {
    const { svc, upserts } = stateService();
    await expect(
      svc.updateSettings("p1", { boards: ["linkedin.com", "dice.com"] }),
    ).rejects.toThrow("dice.com");
    expect(upserts).toHaveLength(0);
  });
});

describe("PilotService.getActivity", () => {
  const completedAt = new Date("2026-07-20T12:00:00Z");

  function activityService(state: { lastCycleAt: Date | null; nextWakeAt: Date | null } | null) {
    const noMax = { _max: { createdAt: null, updatedAt: null } };
    const db = {
      pilotRun: { findMany: async () => [] },
      pilotJournalEntry: { aggregate: async () => noMax },
      feed: { aggregate: async () => noMax },
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
    const svc = activityService({ lastCycleAt: completedAt, nextWakeAt });
    expect((await svc.getActivity("p1")).lastCycle).toEqual({ completedAt, sleepSeconds });
  });

  it("reads a profile with no state row as never run", async () => {
    const activity = await activityService(null).getActivity("p1");
    expect(activity).toMatchObject({ lastCycle: null, lastActivityAt: null });
  });
});
