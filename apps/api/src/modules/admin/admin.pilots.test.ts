// listPilots shape + pagination envelope through AdminService with a fake Prisma. The adminGuard test
// (admin.guard.test.ts) enumerates every /api/admin route, so /pilots is covered for 401/403 there.

import type { PrismaClient } from "@/generated/prisma/client";
import { AdminService } from "./admin.service";
import { describe, expect, it } from "bun:test";

function fakePrisma(
  states: Record<string, unknown>[],
  escalations: { profileId: string; _count: { _all: number } }[],
) {
  return {
    pilotState: {
      findMany: async () => states,
      count: async () => states.length,
    },
    escalation: { groupBy: async () => escalations },
  } as unknown as PrismaClient;
}

describe("AdminService.listPilots", () => {
  it("projects each PilotState to owner email, activity, and open-escalation count", async () => {
    const svc = new AdminService(
      fakePrisma(
        [
          {
            profileId: "p1",
            enabled: true,
            lastCycleAt: new Date("2026-07-15T10:00:00.000Z"),
            cycleCount: 42,
            profile: { user: { email: "alice@example.com" } },
          },
          {
            profileId: "p2",
            enabled: false,
            lastCycleAt: null,
            cycleCount: 0,
            profile: { user: { email: "bob@example.com" } },
          },
        ],
        [{ profileId: "p1", _count: { _all: 2 } }],
      ),
    );

    const page = await svc.listPilots({ page: 1, limit: 20 });
    expect(page.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(page.items).toEqual([
      {
        userEmail: "alice@example.com",
        profileId: "p1",
        enabled: true,
        lastCycleAt: new Date("2026-07-15T10:00:00.000Z"),
        cycleCount: 42,
        openEscalations: 2,
      },
      {
        userEmail: "bob@example.com",
        profileId: "p2",
        enabled: false,
        lastCycleAt: null,
        cycleCount: 0,
        openEscalations: 0,
      },
    ]);
  });
});
