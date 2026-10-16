import type { TaskPayload } from "@jobpilot/contracts/pilot";
import type { Prisma } from "@/generated/prisma/client";
import { AlreadyAppliedError } from "@/modules/campaign/jobs/apply-guard";
import { startApplyBatch } from "./apply-batch";
import { describe, expect, it } from "bun:test";

type BatchJob = TaskPayload<"job.applyBatch">["jobs"][number];

interface FakeJob {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
  status: string;
}

const USER_ID = "u1";
const NOW = new Date("2026-10-05T12:00:00.000Z");

const posting = (key: string, over: Partial<FakeJob> = {}): FakeJob => ({
  campaignId: "c1",
  key,
  url: `https://board.example/jobs/${key}`,
  title: `Engineer ${key}`,
  company: `Company ${key}`,
  status: "approved",
  ...over,
});

const entry = (job: FakeJob): BatchJob => ({
  campaignId: job.campaignId,
  jobKey: job.key,
  url: job.url,
  board: null,
  brief: null,
  matchScore: 80,
});

const same = (job: FakeJob, ref: { campaignId?: string; key?: string }) =>
  job.campaignId === ref.campaignId && job.key === ref.key;

/** Just the reads and the one write `startApplying` makes, over an in-memory job list. */
function fakeTx(opts: {
  jobs: FakeJob[];
  config?: Record<string, unknown>;
  appliedToday?: number;
  appliedUrls?: string[];
}) {
  const { jobs } = opts;
  const tx = {
    pilotState: {
      findUnique: async () => ({ instructionsConfig: opts.config ?? {} }),
    },
    application: {
      count: async () => opts.appliedToday ?? 0,
      findUnique: async ({ where }: { where: { userId_url: { url: string } } }) =>
        opts.appliedUrls?.includes(where.userId_url.url)
          ? {
              id: "a1",
              url: where.userId_url.url,
              title: "Earlier",
              company: "Earlier Co",
              appliedAt: NOW,
            }
          : null,
      findMany: async () => [],
    },
    job: {
      count: async () => jobs.filter((job) => job.status === "applying").length,
      findFirst: async ({ where }: { where: FakeJob }) =>
        jobs.find((job) => same(job, where) && job.status === where.status) ?? null,
      findMany: async ({ where }: { where: { NOT: FakeJob } }) =>
        jobs.filter((job) => job.status === "applying" && !same(job, where.NOT)),
      updateManyAndReturn: async ({
        where,
        data,
      }: {
        where: FakeJob;
        data: { status: string };
      }) => {
        const target = jobs.find((job) => same(job, where) && job.status === where.status);
        if (!target) return [];
        target.status = data.status;
        return [target];
      },
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

const start = (tx: Prisma.TransactionClient, jobs: FakeJob[]) =>
  startApplyBatch(tx, USER_ID, jobs.map(entry), NOW);

describe("startApplyBatch", () => {
  it("moves every entry into applying while the budget has room", async () => {
    const jobs = [posting("j1"), posting("j2")];
    const batch = await start(fakeTx({ jobs, config: { maxConcurrentApplies: 2 } }), jobs);
    expect(batch.jobs.map((job) => job.jobKey)).toEqual(["j1", "j2"]);
    expect(jobs.map((job) => job.status)).toEqual(["applying", "applying"]);
  });

  it("stops at the concurrency limit, counting applies already in flight", async () => {
    const jobs = [posting("busy", { status: "applying" }), posting("j1"), posting("j2")];
    const tx = fakeTx({ jobs, config: { maxConcurrentApplies: 2 } });
    const batch = await start(tx, jobs.slice(1));
    expect(batch.jobs.map((job) => job.jobKey)).toEqual(["j1"]);
    expect(jobs[2].status).toBe("approved");
  });

  it("stops at the daily cap, counting applies already in flight", async () => {
    const jobs = [posting("j1"), posting("j2"), posting("j3")];
    const config = { maxConcurrentApplies: 3, dailyApplyCap: 5 };
    const batch = await start(fakeTx({ jobs, config, appliedToday: 3 }), jobs);
    expect(batch.jobs).toHaveLength(2);
  });

  it("refuses when the budget has no room at all", async () => {
    const jobs = [posting("j1"), posting("j2")];
    const config = { maxConcurrentApplies: 2, dailyApplyCap: 4 };
    const tx = fakeTx({ jobs, config, appliedToday: 4 });
    await expect(start(tx, jobs)).rejects.toThrow("No apply budget");
  });

  it("drops an applied duplicate, hands it back for skipping, and starts the rest", async () => {
    const jobs = [posting("dup"), posting("j2")];
    const tx = fakeTx({
      jobs,
      config: { maxConcurrentApplies: 2 },
      appliedUrls: [jobs[0].url],
    });
    const batch = await start(tx, jobs);
    expect(batch.jobs.map((job) => job.jobKey)).toEqual(["j2"]);
    expect(batch.duplicates).toHaveLength(1);
    expect(batch.duplicates[0]).toBeInstanceOf(AlreadyAppliedError);
    expect(jobs[0].status).toBe("approved");
  });

  it("refuses the second campaign's copy of a posting the batch already started", async () => {
    const first = posting("j1");
    const copy = posting("j1", { campaignId: "c2" });
    const batch = await start(
      fakeTx({ jobs: [first, copy], config: { maxConcurrentApplies: 2 } }),
      [first, copy],
    );
    expect(batch.jobs).toEqual([entry(first)]);
    expect(copy.status).toBe("approved");
  });

  it("refuses the run when no entry could start", async () => {
    const jobs = [posting("j1", { status: "skipped" }), posting("j2", { status: "skipped" })];
    const tx = fakeTx({ jobs, config: { maxConcurrentApplies: 2 } });
    await expect(start(tx, jobs)).rejects.toThrow("No job in the batch could start");
  });
});
