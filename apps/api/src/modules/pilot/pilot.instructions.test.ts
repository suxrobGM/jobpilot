// Fake-Prisma unit test for the instructions edit and the run-state guards.
import {
  pilotInstructionsChangeSchema,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

function instructionsService(prevGoals: string) {
  const rec = {
    searchResets: 0,
    searchDeletes: 0,
    bootstrapClaimDeletes: 0,
    campaignsCompleted: 0,
    jobsDropped: 0,
  };
  const stateRow = (goals: string) => ({
    userId: "p1",
    running: false,
    instructionsGoals: goals,
    instructionsConfig: {},
    instructionsUpdatedAt: new Date(),
    lastCycleAt: null,
    cycleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const db = {
    pilotState: {
      findUnique: async () => ({ instructionsGoals: prevGoals }),
      upsert: async (a: { update: { instructionsGoals: string } }) =>
        stateRow(a.update.instructionsGoals),
    },
    pilotSearch: {
      updateMany: async () => {
        rec.searchResets++;
        return { count: 0 };
      },
      deleteMany: async () => {
        rec.searchDeletes++;
        return { count: 2 };
      },
    },
    pilotClaim: {
      deleteMany: async () => {
        rec.bootstrapClaimDeletes++;
        return { count: 1 };
      },
    },
    campaign: {
      updateMany: async () => {
        rec.campaignsCompleted++;
        return { count: 1 };
      },
    },
    job: {
      updateMany: async () => {
        rec.jobsDropped++;
        return { count: 4 };
      },
    },
    application: { count: async () => 0 },
    networkingMessage: { count: async () => 0 },
    // The delete + claim-clear pair is one transaction; the fake runs the operations it is handed.
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { svc: new PilotService(db as unknown as PrismaClient), rec };
}

describe("PilotService.updateInstructions", () => {
  const body = (goals: string, onChange = {}) => ({
    goals,
    config: pilotInstructionsConfigSchema.parse({}),
    onChange: pilotInstructionsChangeSchema.parse(onChange),
  });

  it("resets every search's scheduling when the goals change", async () => {
    const { svc, rec } = instructionsService("old goals");
    await svc.updateInstructions("p1", body("new goals"));
    expect(rec.searchResets).toBe(1);
  });

  it("leaves searches untouched when the goals are unchanged", async () => {
    const { svc, rec } = instructionsService("same goals");
    await svc.updateInstructions("p1", body("same goals"));
    expect(rec.searchResets).toBe(0);
  });

  it("retires nothing when the user asked for nothing", async () => {
    const { svc, rec } = instructionsService("old goals");
    await svc.updateInstructions("p1", body("new goals"));
    expect(rec).toMatchObject({
      searchDeletes: 0,
      bootstrapClaimDeletes: 0,
      campaignsCompleted: 0,
      jobsDropped: 0,
    });
  });

  it("clears the bootstrap damper with the searches, or the re-derive waits a day", async () => {
    const { svc, rec } = instructionsService("old goals");
    await svc.updateInstructions("p1", body("new goals", { rederiveSearches: true }));
    expect(rec).toMatchObject({ searchDeletes: 1, bootstrapClaimDeletes: 1 });
  });

  it("completes campaigns and drops the approved backlog when asked", async () => {
    const { svc, rec } = instructionsService("old goals");
    await svc.updateInstructions(
      "p1",
      body("new goals", { completeCampaigns: true, dropApprovedJobs: true }),
    );
    expect(rec).toMatchObject({ campaignsCompleted: 1, jobsDropped: 1 });
  });
});

function runStateService(goals: string) {
  const stateRow = (running: boolean) => ({
    userId: "p1",
    running,
    instructionsGoals: goals,
    instructionsConfig: {},
    instructionsUpdatedAt: new Date(),
    lastCycleAt: null,
    cycleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const db = {
    pilotState: {
      findUnique: async () => ({ instructionsGoals: goals }),
      upsert: async (a: { update: { running: boolean } }) => stateRow(a.update.running),
    },
    application: { count: async () => 0 },
    networkingMessage: { count: async () => 0 },
  };
  return new PilotService(db as unknown as PrismaClient);
}

describe("PilotService.start goals guard", () => {
  it("rejects starting when the goals are empty", async () => {
    const svc = runStateService("   ");
    await expect(svc.start("p1")).rejects.toMatchObject({ status: 409 });
  });

  it("starts when the goals are non-empty", async () => {
    const svc = runStateService("ship senior frontend roles");
    const state = await svc.start("p1");
    expect(state.running).toBe(true);
  });

  it("stops without guarding on empty goals", async () => {
    const svc = runStateService("");
    const state = await svc.stop("p1");
    expect(state.running).toBe(false);
  });
});
