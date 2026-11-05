// 401/403 on /pilots is covered by admin.guard.test.ts, which walks every /api/admin route.

import type { PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import { AdminService } from "./admin.service";
import { describe, expect, it } from "bun:test";

function fakePrisma(
  states: Record<string, unknown>[],
  questions: { userId: string; _count: { _all: number } }[],
) {
  return {
    pilotState: {
      findMany: async () => states,
      count: async () => states.length,
    },
    pilotQuestion: { groupBy: async () => questions },
    pilotRun: {
      groupBy: async () => [
        {
          userId: "p1",
          _sum: {
            inputTokens: 100,
            outputTokens: 20,
            cacheReadTokens: 3000,
            cacheWriteTokens: null,
          },
        },
      ],
    },
  } as unknown as PrismaClient;
}

describe("AdminService.listPilots", () => {
  it("projects each PilotState to owner email, activity, open questions, and week tokens", async () => {
    const svc = new AdminService(
      fakePrisma(
        [
          {
            userId: "p1",
            autopilot: true,
            lastCycleAt: new Date("2026-07-15T10:00:00.000Z"),
            cycleCount: 42,
            user: { email: "alice@example.com" },
          },
          {
            userId: "p2",
            autopilot: false,
            lastCycleAt: null,
            cycleCount: 0,
            user: { email: "bob@example.com" },
          },
        ],
        [{ userId: "p1", _count: { _all: 2 } }],
      ),
      makeBoards(),
    );

    const page = await svc.listPilots({ page: 1, limit: 20 });
    expect(page.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(page.items).toEqual([
      {
        userEmail: "alice@example.com",
        userId: "p1",
        autopilot: true,
        lastCycleAt: new Date("2026-07-15T10:00:00.000Z"),
        cycleCount: 42,
        openQuestions: 2,
        weekTokens: { input: 100, output: 20, cacheRead: 3000, cacheWrite: 0 },
      },
      {
        userEmail: "bob@example.com",
        userId: "p2",
        autopilot: false,
        lastCycleAt: null,
        cycleCount: 0,
        openQuestions: 0,
        weekTokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ]);
  });
});
