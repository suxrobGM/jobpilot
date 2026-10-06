import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { promoteScoredPendingJobs, runExpiry } from "./maintenance";
import { describe, expect, it } from "bun:test";

type Write = { where: Record<string, unknown>; data: Record<string, unknown> };

function expiryDb(options: {
  expiredRuns?: Record<string, unknown>[];
  openApplyRuns?: Record<string, unknown>[];
  expiredQuestions?: Record<string, unknown>[];
}) {
  const writes = { jobs: [] as Write[], runs: [] as Write[], questions: [] as Write[] };
  let transactions = 0;
  const db = {
    pilotRun: {
      // The expired scan has no task type filter; the stranded-apply sweep reads open apply runs.
      findMany: async (a: { where: { taskType?: unknown } }) =>
        a.where.taskType ? (options.openApplyRuns ?? []) : (options.expiredRuns ?? []),
      updateMany: async (a: Write) => {
        writes.runs.push(a);
        return { count: 1 };
      },
    },
    pilotQuestion: {
      findMany: async () => options.expiredQuestions ?? [],
      updateMany: async (a: Write) => {
        writes.questions.push(a);
        return { count: 1 };
      },
    },
    job: {
      updateMany: async (a: Write) => {
        writes.jobs.push(a);
        return { count: 1 };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      transactions += 1;
      return work(db);
    },
  };
  const run = () => runExpiry(db as unknown as PrismaClient, "u1", new Date());
  const jobWrite = (status: string) => writes.jobs.find((w) => w.where.status === status);
  return { run, writes, jobWrite, transactions: () => transactions };
}

describe("runExpiry", () => {
  it("expires a lapsed run and returns its applying job to approved, in one transaction", async () => {
    const db = expiryDb({
      expiredRuns: [
        { id: "l1", taskType: "job.apply", payload: { campaignId: "c1", jobKey: "j1" } },
      ],
    });
    await db.run();
    expect(db.transactions()).toBe(1);
    expect(db.writes.runs[0]).toMatchObject({ data: { outcome: "expired" } });
    expect(db.writes.jobs[0]).toMatchObject({
      where: { status: "applying", OR: [{ campaignId: "c1", key: "j1" }] },
      data: { status: "approved" },
    });
  });

  it("skips the job an expired question parked", async () => {
    const db = expiryDb({
      expiredQuestions: [{ id: "q1", subjectType: "job", subjectId: "c1:j1" }],
    });
    await db.run();
    expect(db.writes.questions[0]).toMatchObject({ data: { status: "expired" } });
    expect(db.jobWrite("needs_user")).toMatchObject({
      where: { OR: [{ campaignId: "c1", key: "j1" }] },
      data: { status: "skipped" },
    });
  });

  it("reverts stranded applies, sparing ones an open run still covers", async () => {
    const db = expiryDb({
      openApplyRuns: [{ taskType: "job.apply", payload: { campaignId: "c1", jobKey: "held" } }],
    });
    await db.run();
    expect(db.jobWrite("applying")).toMatchObject({
      where: { NOT: [{ campaignId: "c1", key: "held" }], updatedAt: { lt: expect.any(Date) } },
      data: { status: "approved" },
    });
  });

  it("reverts every job of an expired batch run", async () => {
    const batch = {
      jobs: [
        { campaignId: "c1", jobKey: "j1" },
        { campaignId: "c2", jobKey: "j2" },
      ],
    };
    const db = expiryDb({
      expiredRuns: [{ id: "b1", taskType: "job.applyBatch", payload: batch }],
    });
    await db.run();
    expect(db.writes.jobs[0]).toMatchObject({
      where: {
        OR: [
          { campaignId: "c1", key: "j1" },
          { campaignId: "c2", key: "j2" },
        ],
      },
      data: { status: "approved" },
    });
  });

  it("spares every job an open batch run still covers", async () => {
    const batch = {
      jobs: [
        { campaignId: "c1", jobKey: "a" },
        { campaignId: "c1", jobKey: "b" },
      ],
    };
    const db = expiryDb({ openApplyRuns: [{ taskType: "job.applyBatch", payload: batch }] });
    await db.run();
    expect(db.jobWrite("applying")).toMatchObject({
      where: {
        NOT: [
          { campaignId: "c1", key: "a" },
          { campaignId: "c1", key: "b" },
        ],
      },
    });
  });

  it("skips stale approved jobs in pilot campaigns only", async () => {
    const db = expiryDb({});
    await db.run();
    expect(db.jobWrite("approved")).toMatchObject({
      where: {
        campaign: { userId: "u1", createdBy: "pilot" },
        createdAt: { lt: expect.any(Date) },
      },
      data: { status: "skipped", skipReason: "Posting went stale before the pilot applied." },
    });
  });
});

describe("promoteScoredPendingJobs", () => {
  const scored = (matchScore: number, config: Record<string, unknown> = {}) => ({
    campaignId: "c1",
    key: "jobkey",
    matchScore,
    campaign: { config, source: "auto_apply" },
  });

  const promote = async (rows: Record<string, unknown>[]) => {
    const calls: unknown[][] = [];
    const prisma = { job: { findMany: async () => rows } } as unknown as PrismaClient;
    const campaignJobs = {
      promoteScoredJobs: async (...args: unknown[]) => {
        calls.push(args);
      },
    } as unknown as CampaignJobService;
    await promoteScoredPendingJobs(prisma, campaignJobs, "p1", 60);
    return calls;
  };

  it("settles each campaign's jobs against the pilot's fallback threshold", async () => {
    expect(await promote([scored(75)])).toEqual([
      ["p1", "c1", "auto_apply", [{ key: "jobkey", matchScore: 75, threshold: 60 }]],
    ]);
  });

  it("prefers the campaign's own minScore", async () => {
    const [call] = await promote([scored(75, { minScore: 80 })]);
    expect(call[3]).toEqual([{ key: "jobkey", matchScore: 75, threshold: 80 }]);
  });
});
