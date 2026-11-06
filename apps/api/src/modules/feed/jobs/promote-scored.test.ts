import { AUTO_APPLY_FEED_KINDS } from "@jobpilot/contracts/feed";
import type { PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import type { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { JobService } from "./job.service";
import { describe, expect, it } from "bun:test";

interface UpdateCall {
  where: {
    matchScore?: number;
    key?: { in: string[] };
    status?: string;
    feed?: { kind?: { in: string[] } };
  };
  data: { status?: string; skipReason?: string };
}

function setup() {
  const jobUpdates: UpdateCall[] = [];
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
          brief: null,
        }));
      },
      groupBy: async () => [],
    },
    networkingMessage: {
      groupBy: async () => [],
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const listings = { publishInBackground: () => undefined } as unknown as JobListingPublisher;
  return {
    service: new JobService(db as unknown as PrismaClient, listings, makeBoards()),
    jobUpdates,
  };
}

describe("JobService.settleScored", () => {
  it("keeps the concurrent-rescore guard exact by grouping on the candidate's score", async () => {
    const state = setup();
    await state.service.settleScored("u1", "c1", [
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
    await state.service.settleScored("u1", "c1", [
      { key: "d", matchScore: 30, threshold: 50 },
      { key: "f", matchScore: 10, threshold: 50 },
    ]);

    const reasons = state.jobUpdates.map((u) => u.data.skipReason).sort();
    expect(reasons).toEqual([
      "Below minimum match score (10 < 50)",
      "Below minimum match score (30 < 50)",
    ]);
  });

  it("promotes only in the feeds the pilot applies from on its own", async () => {
    const state = setup();
    await state.service.settleScored("u1", "c1", [{ key: "a", matchScore: 90, threshold: 50 }]);

    expect(state.jobUpdates[0]?.where.feed?.kind?.in).toEqual([...AUTO_APPLY_FEED_KINDS]);
    expect(state.jobUpdates[0]?.data.status).toBe("approved");
  });
});
