import type { PrismaClient } from "@/generated/prisma/client";
import type { JobBoardService } from "@/modules/job-board/job-board.service";
import type { PilotService } from "../pilot.service";
import { ChangeService } from "./change.service";
import { describe, expect, it } from "bun:test";

const RULES = { type: "rules.set" as const, minScore: 70 };

function makeService() {
  let transactions = 0;
  const db = {
    pilotChange: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ch1",
        createdAt: new Date(),
        decidedAt: null,
        undo: null,
        ...data,
      }),
    },
    $transaction: async () => {
      transactions++;
      throw new Error("a proposal must not open a transaction");
    },
  };
  const boards = { resolveId: async () => null } as unknown as JobBoardService;
  const pilot = { publishCurrentState: async () => undefined } as unknown as PilotService;
  const service = new ChangeService(db as unknown as PrismaClient, boards, pilot);
  return { service, transactions: () => transactions };
}

describe("ChangeService.create", () => {
  it("stores a proposal without applying any of its actions", async () => {
    const { service, transactions } = makeService();
    const change = await service.create("u1", {
      summary: "Raise the min score",
      actions: [RULES],
      source: "pilot",
      propose: true,
    });
    expect(change).toMatchObject({ status: "proposed", canUndo: false });
    expect(transactions()).toBe(0);
  });

  it("refuses a pilot change to rules that isn't a proposal", async () => {
    const { service } = makeService();
    const change = service.create("u1", {
      summary: "Raise the min score",
      actions: [RULES],
      source: "pilot",
      propose: false,
    });
    await expect(change).rejects.toMatchObject({ status: 403 });
  });
});
