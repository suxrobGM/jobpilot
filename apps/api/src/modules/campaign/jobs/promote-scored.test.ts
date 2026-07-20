import type { PrismaClient } from "@/generated/prisma/client";
import type { JobListingIngestService } from "@/modules/job-listing";
import { CampaignJobService } from "./job.service";
import { describe, expect, it } from "bun:test";

interface UpdateCall {
  where: { matchScore?: number; key?: { in: string[] }; status?: string };
  data: { status?: string; skipReason?: string };
}

function setup() {
  const jobUpdates: UpdateCall[] = [];
  const queueUpdates: Record<string, unknown>[] = [];
  const db = {
    job: {
      updateManyAndReturn: async (args: UpdateCall) => {
        jobUpdates.push(args);
        // Echo one row per requested key, as Postgres would for rows matching the guard.
        return (args.where.key?.in ?? []).map((key) => ({
          id: `id-${key}`,
          key,
          url: `https://example.test/${key}`,
          status: args.data.status,
        }));
      },
      groupBy: async () => [],
    },
    queueEntry: {
      updateMany: async (args: Record<string, unknown>) => {
        queueUpdates.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const listings = { ingestInBackground: () => undefined } as unknown as JobListingIngestService;
  return {
    service: new CampaignJobService(db as unknown as PrismaClient, listings),
    jobUpdates,
    queueUpdates,
  };
}

describe("CampaignJobService.promoteScoredJobs", () => {
  it("batches one write per outcome and score rather than three per candidate", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", [
      { key: "a", matchScore: 90, threshold: 50 },
      { key: "b", matchScore: 90, threshold: 50 },
      { key: "c", matchScore: 70, threshold: 50 },
      { key: "d", matchScore: 30, threshold: 50 },
      { key: "e", matchScore: 30, threshold: 50 },
      { key: "f", matchScore: 10, threshold: 50 },
    ]);

    // approved@90, approved@70, skipped@30, skipped@10 - four writes for six candidates.
    expect(state.jobUpdates).toHaveLength(4);
    const approved = state.jobUpdates.filter((u) => u.data.status === "approved");
    expect(approved.flatMap((u) => u.where.key?.in ?? []).sort()).toEqual(["a", "b", "c"]);
    expect(approved.find((u) => u.where.matchScore === 90)?.where.key?.in).toEqual(["a", "b"]);
  });

  it("keeps the concurrent-rescore guard exact by grouping on the candidate's score", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", [
      { key: "a", matchScore: 90, threshold: 50 },
      { key: "d", matchScore: 30, threshold: 50 },
    ]);

    for (const update of state.jobUpdates) {
      expect(update.where.status).toBe("pending");
      expect(typeof update.where.matchScore).toBe("number");
    }
  });

  it("carries each skipped group's own score into its reason", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", [
      { key: "d", matchScore: 30, threshold: 50 },
      { key: "f", matchScore: 10, threshold: 50 },
    ]);

    const reasons = state.jobUpdates.map((u) => u.data.skipReason).sort();
    expect(reasons).toEqual([
      "Below minimum match score (10 < 50)",
      "Below minimum match score (30 < 50)",
    ]);
  });

  it("retires every skipped job's queue entry in a single write", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", [
      { key: "a", matchScore: 90, threshold: 50 },
      { key: "d", matchScore: 30, threshold: 50 },
      { key: "f", matchScore: 10, threshold: 50 },
    ]);

    expect(state.queueUpdates).toHaveLength(1);
    expect(state.queueUpdates[0]).toMatchObject({
      where: { url: { in: ["https://example.test/d", "https://example.test/f"] } },
      data: { status: "skipped" },
    });
  });

  it("writes nothing when there are no candidates", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", []);
    expect(state.jobUpdates).toHaveLength(0);
    expect(state.queueUpdates).toHaveLength(0);
  });
});
