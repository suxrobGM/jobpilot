import type { PrismaClient } from "@/generated/prisma/client";
import { runExpiry } from "./expiry";
import { describe, expect, it } from "bun:test";

function setup(options: {
  claims?: Record<string, unknown>[];
  questions?: Record<string, unknown>[];
  openApplyClaims?: Record<string, unknown>[];
}) {
  const jobWrites: Record<string, unknown>[] = [];
  const queueWrites: Record<string, unknown>[] = [];
  const claimWrites: Record<string, unknown>[] = [];
  const questionWrites: Record<string, unknown>[] = [];
  let transactions = 0;
  const db = {
    pilotClaim: {
      // The expired-claim scan has no kind filter; the stale-applying sweep reads open job.apply claims.
      findMany: async (args: { where: { kind?: string } }) =>
        args.where.kind === "job.apply" ? (options.openApplyClaims ?? []) : (options.claims ?? []),
      updateMany: async (args: Record<string, unknown>) => {
        claimWrites.push(args);
        return { count: options.claims?.length ?? 0 };
      },
    },
    pilotQuestion: {
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
    claimWrites,
    questionWrites,
    get transactions() {
      return transactions;
    },
  };
}

describe("agenda expiry", () => {
  it("releases an expired claim and reverts its applying job in one transaction", async () => {
    const state = setup({
      claims: [
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
    expect(state.claimWrites[0]).toMatchObject({ data: { outcome: "expired" } });
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
    const skip = state.jobWrites.find((w) => (w.data as { status?: string }).status === "skipped");
    expect(skip).toMatchObject({ data: { status: "skipped" } });
    expect(state.queueWrites[0]).toMatchObject({ data: { status: "skipped" } });
  });

  it("reverts stale applying jobs while sparing ones under an open apply claim", async () => {
    const state = setup({
      openApplyClaims: [{ payload: { campaignId: "c1", jobKey: "held" } }],
    });
    await state.run();
    const sweep = state.jobWrites.find(
      (w) => (w.where as { status?: string }).status === "applying",
    );
    expect(sweep).toMatchObject({
      where: {
        status: "applying",
        NOT: [{ campaignId: "c1", key: "held" }],
        updatedAt: { lt: expect.any(Date) },
      },
      data: { status: "approved" },
    });
  });
});
