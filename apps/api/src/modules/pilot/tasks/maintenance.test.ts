import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { expireAbandonedRuns, promoteScoredPendingJobs, runExpiry } from "./maintenance";
import { describe, expect, it } from "bun:test";

type Write = { where: Record<string, unknown>; data: Record<string, unknown> };

function expiryDb(options: {
  expiredRuns?: Record<string, unknown>[];
  openApplyRuns?: Record<string, unknown>[];
  expiredQuestions?: Record<string, unknown>[];
}) {
  const writes = {
    jobs: [] as Write[],
    runs: [] as Write[],
    questions: [] as Write[],
    requests: [] as Write[],
  };
  let transactions = 0;
  const db = {
    pilotRun: {
      // The expired scan has no task type filter; the stranded-apply sweep reads open job.apply runs.
      findMany: async (a: { where: { taskType?: string } }) =>
        a.where.taskType ? (options.openApplyRuns ?? []) : (options.expiredRuns ?? []),
      updateMany: async (a: Write) => {
        writes.runs.push(a);
        return { count: 1 };
      },
    },
    pilotRequest: {
      updateManyAndReturn: async (a: Write) => {
        writes.requests.push(a);
        return [];
      },
    },
    pilotQuestion: {
      findMany: async () => options.expiredQuestions ?? [],
      updateMany: async (a: Write) => {
        writes.questions.push(a);
        return { count: 1 };
      },
    },
    campaignJob: {
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
    // The agent never finished, so whatever it was asked for failed.
    expect(db.writes.requests[0]).toMatchObject({ data: { status: "failed" } });
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
    const db = expiryDb({ openApplyRuns: [{ payload: { campaignId: "c1", jobKey: "held" } }] });
    await db.run();
    expect(db.jobWrite("applying")).toMatchObject({
      where: { NOT: [{ campaignId: "c1", key: "held" }], updatedAt: { lt: expect.any(Date) } },
      data: { status: "approved" },
    });
  });

  it("skips stale approved jobs in pilot campaigns only", async () => {
    const db = expiryDb({});
    await db.run();
    expect(db.jobWrite("approved")).toMatchObject({
      where: {
        userId: "u1",
        campaign: { createdBy: "pilot" },
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
    const prisma = { campaignJob: { findMany: async () => rows } } as unknown as PrismaClient;
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

describe("expireAbandonedRuns", () => {
  it("expires runs once per user found by either scan, touching no queue or question", async () => {
    const swept: string[] = [];
    const tx = {
      pilotRun: {
        findMany: async (a: { where: { userId: string; taskType?: string } }) => {
          if (!a.where.taskType) swept.push(a.where.userId);
          return [];
        },
      },
      campaignJob: { updateMany: async () => ({ count: 0 }) },
    };
    const db = {
      pilotRun: { findMany: async () => [{ userId: "u1" }, { userId: "u2" }] },
      campaign: { findMany: async () => [{ userId: "u2" }, { userId: "u3" }] },
      $transaction: async (work: (t: unknown) => Promise<unknown>) => work(tx),
    };
    const users = await expireAbandonedRuns(db as unknown as PrismaClient, new Date());
    expect(users).toBe(3);
    expect(swept).toEqual(["u1", "u2", "u3"]);
  });
});
