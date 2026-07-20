import type { PrismaClient } from "@/generated/prisma/client";
import { runExpiry } from "./expiry";
import { describe, expect, it } from "bun:test";

function setup(options: {
  leases?: Record<string, unknown>[];
  questions?: Record<string, unknown>[];
}) {
  const jobWrites: Record<string, unknown>[] = [];
  const queueWrites: Record<string, unknown>[] = [];
  const leaseWrites: Record<string, unknown>[] = [];
  const questionWrites: Record<string, unknown>[] = [];
  let transactions = 0;
  const db = {
    pilotLease: {
      findMany: async () => options.leases ?? [],
      updateMany: async (args: Record<string, unknown>) => {
        leaseWrites.push(args);
        return { count: options.leases?.length ?? 0 };
      },
    },
    question: {
      findMany: async () => options.questions ?? [],
      updateMany: async (args: Record<string, unknown>) => {
        questionWrites.push(args);
        return { count: options.questions?.length ?? 0 };
      },
    },
    job: {
      updateMany: async (args: Record<string, unknown>) => {
        jobWrites.push(args);
        return { count: 1 };
      },
      updateManyAndReturn: async (args: Record<string, unknown>) => {
        jobWrites.push(args);
        return [{ url: "https://example.test/job" }];
      },
    },
    queueEntry: {
      updateMany: async (args: Record<string, unknown>) => {
        queueWrites.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      transactions += 1;
      return work(db);
    },
  };
  const run = () => runExpiry(db as unknown as PrismaClient, "u1", new Date());
  return {
    run,
    jobWrites,
    queueWrites,
    leaseWrites,
    questionWrites,
    get transactions() {
      return transactions;
    },
  };
}

describe("agenda expiry", () => {
  it("releases an expired lease and reverts its applying job in one transaction", async () => {
    const state = setup({
      leases: [
        {
          id: "l1",
          kind: "job.apply",
          subjectId: "j1",
          payload: { campaignId: "c1", jobKey: "j1" },
        },
      ],
    });
    await state.run();
    expect(state.transactions).toBe(1);
    expect(state.leaseWrites[0]).toMatchObject({ data: { outcome: "expired" } });
    expect(state.jobWrites[0]).toMatchObject({
      where: { status: "applying", OR: [{ campaignId: "c1", key: "j1" }] },
      data: { status: "approved" },
    });
  });

  it("expires a question and skips its parked job and queue entry atomically", async () => {
    const state = setup({
      questions: [{ id: "q1", subjectType: "job", subjectId: "c1:j1" }],
    });
    await state.run();
    expect(state.transactions).toBe(1);
    expect(state.questionWrites[0]).toMatchObject({ data: { status: "expired" } });
    expect(state.jobWrites[0]).toMatchObject({ data: { status: "skipped" } });
    expect(state.queueWrites[0]).toMatchObject({ data: { status: "skipped" } });
  });
});
