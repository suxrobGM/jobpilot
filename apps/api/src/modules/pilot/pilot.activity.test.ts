// Fake-Prisma unit test for the liveness read the terminal orchestrator polls.
import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

function activityService(
  cycleEntry: Record<string, unknown> | null,
  state: { running: boolean } | null = { running: true },
) {
  const noMax = { _max: { createdAt: null, updatedAt: null } };
  const db = {
    pilotClaim: { findMany: async () => [] },
    pilotJournalEntry: {
      aggregate: async () => noMax,
      findFirst: async () => cycleEntry,
    },
    campaign: { aggregate: async () => noMax },
    job: { aggregate: async () => noMax },
    pilotState: { findUnique: async () => state },
  };
  return new PilotService(db as unknown as PrismaClient);
}

describe("PilotService.getActivity lastCycle", () => {
  const completedAt = new Date("2026-07-20T12:00:00Z");

  it("maps the newest cycle entry's detail into lastCycle", async () => {
    const svc = activityService({
      cycleId: "cyc-1",
      createdAt: completedAt,
      detail: { status: "ok", sleepSeconds: 300 },
    });
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toEqual({
      cycleId: "cyc-1",
      completedAt,
      status: "ok",
      sleepSeconds: 300,
    });
  });

  it("nulls status and sleepSeconds for a detail-less cycle (the stall-recovery path)", async () => {
    const svc = activityService({ cycleId: null, createdAt: completedAt, detail: {} });
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toEqual({
      cycleId: null,
      completedAt,
      status: null,
      sleepSeconds: null,
    });
  });

  it("returns null lastCycle when no cycle entry exists", async () => {
    const svc = activityService(null);
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toBeNull();
  });
});

describe("PilotService.getActivity running", () => {
  it("carries the run-state the host's pre-inject gate reads", async () => {
    expect((await activityService(null, { running: true }).getActivity("p1")).running).toBe(true);
    expect((await activityService(null, { running: false }).getActivity("p1")).running).toBe(false);
  });

  it("reads a profile with no PilotState row as stopped", async () => {
    expect((await activityService(null, null).getActivity("p1")).running).toBe(false);
  });
});
