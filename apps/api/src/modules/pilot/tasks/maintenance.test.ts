import { MAYBE_SUBMITTED_REASON } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { promoteScoredPendingJobs, runExpiry } from "./maintenance";
import { describe, expect, it } from "bun:test";

type Write = { where: Record<string, unknown>; data: Record<string, unknown> };

const statusOf = (write: Write) => (write.data as { status?: string } | undefined)?.status;

function expiryDb(options: {
  expiredRuns?: Record<string, unknown>[];
  openApplyRuns?: Record<string, unknown>[];
  expiredQuestions?: Record<string, unknown>[];
  /** Questions already open against a parked job, which recovery must not duplicate. */
  openQuestions?: Record<string, unknown>[];
  /** Rows recovery finds in `applying`; it parks all of them, stamped or not. */
  interruptedJobs?: Record<string, unknown>[];
}) {
  const writes = { jobs: [] as Write[], runs: [] as Write[], questions: [] as Write[] };
  const createdQuestions: Record<string, unknown>[] = [];
  let transactions = 0;
  const interrupted = options.interruptedJobs ?? [
    { campaignId: "c1", key: "j1", title: "Engineer", company: "Acme", submitAttemptedAt: null },
  ];
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
    pilotQuestion: {
      // Recovery's dedupe lookup filters by subjectId; the expiry scan does not.
      findMany: async (a: { where: Record<string, unknown> }) =>
        a.where.subjectId ? (options.openQuestions ?? []) : (options.expiredQuestions ?? []),
      create: async (a: { data: Record<string, unknown> }) => {
        createdQuestions.push(a.data);
        return a.data;
      },
      updateMany: async (a: Write) => {
        writes.questions.push(a);
        return { count: 1 };
      },
    },
    job: {
      // The re-read of what was parked only sees rows a write moved to needs_user.
      findMany: async (a: { where: Record<string, unknown> }) => {
        if (a.where.status !== "needs_user") return interrupted;
        return writes.jobs.some((w) => statusOf(w) === "needs_user") ? interrupted : [];
      },
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
  return { run, writes, createdQuestions, jobWrite, transactions: () => transactions };
}

const expiredApplyRun = {
  id: "l1",
  taskType: "job.apply",
  payload: { campaignId: "c1", jobKey: "j1" },
};

describe("runExpiry", () => {
  it("expires a lapsed run and parks its applying job, in one transaction", async () => {
    const db = expiryDb({ expiredRuns: [expiredApplyRun] });
    await db.run();
    expect(db.transactions()).toBe(1);
    expect(db.writes.runs[0]).toMatchObject({ data: { outcome: "expired" } });
    // Parked, not re-approved: an interrupted apply may already be with the employer.
    expect(db.writes.jobs[0]).toMatchObject({
      where: {
        AND: [
          { status: "applying", OR: [{ campaignId: "c1", key: "j1" }] },
          { OR: [{ campaignId: "c1", key: "j1" }] },
        ],
      },
      data: { status: "needs_user" },
    });
    expect(db.writes.jobs.every((w) => statusOf(w) !== "approved")).toBe(true);
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

  it("parks stranded applies, sparing ones an open run still covers", async () => {
    const db = expiryDb({ openApplyRuns: [{ payload: { campaignId: "c1", jobKey: "held" } }] });
    await db.run();
    const sweep = db.writes.jobs.find((w) => JSON.stringify(w.where.AND ?? null).includes("held"));
    expect(sweep).toMatchObject({
      where: {
        AND: [
          {
            status: "applying",
            NOT: [{ campaignId: "c1", key: "held" }],
            updatedAt: { lt: expect.any(Date) },
          },
          { OR: expect.any(Array) },
        ],
      },
      data: { status: "needs_user" },
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

describe("runExpiry recovery questions", () => {
  it("parks a stamped job as maybe submitted and asks about it", async () => {
    const db = expiryDb({
      expiredRuns: [expiredApplyRun],
      interruptedJobs: [
        {
          campaignId: "c1",
          key: "j1",
          title: "Director of Engineering",
          company: "Initech",
          submitAttemptedAt: new Date("2026-08-10T12:00:00Z"),
        },
      ],
    });
    await db.run();
    const parked = db.writes.jobs.find((w) => statusOf(w) === "needs_user");
    expect(parked?.data).toMatchObject({ skipReason: MAYBE_SUBMITTED_REASON });
    expect(db.createdQuestions.some((q) => String(q.prompt).includes("Initech"))).toBe(true);
  });

  it("asks nothing when the job already has an open question", async () => {
    const db = expiryDb({
      expiredRuns: [expiredApplyRun],
      openQuestions: [{ subjectId: "c1:j1" }],
    });
    await db.run();
    expect(db.createdQuestions).toHaveLength(0);
  });

  // A question only in the database never reaches the user, and its parked job wedges the campaign.
  it("returns the questions it raised so the caller can publish them", async () => {
    const db = expiryDb({ expiredRuns: [expiredApplyRun] });
    expect((await db.run()).length).toBeGreaterThan(0);
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
