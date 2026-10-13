import type { PrismaClient } from "@/generated/prisma/client";
import type { JobListingPublisher } from "@/modules/job-listing/publishing/job-listing.publisher";
import { CampaignJobService } from "./job.service";
import { describe, expect, it } from "bun:test";

interface UpdateCall {
  where: {
    matchScore?: number;
    key?: { in: string[] };
    status?: string;
    description?: { not: null };
    campaign?: { source?: { in: string[] } };
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
    service: new CampaignJobService(db as unknown as PrismaClient, listings),
    jobUpdates,
  };
}

describe("CampaignJobService.promoteScoredJobs", () => {
  it("keeps the concurrent-rescore guard exact by grouping on the candidate's score", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", "auto_apply", [
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
    await state.service.promoteScoredJobs("u1", "c1", "auto_apply", [
      { key: "d", matchScore: 30, threshold: 50 },
      { key: "f", matchScore: 10, threshold: 50 },
    ]);

    const reasons = state.jobUpdates.map((u) => u.data.skipReason).sort();
    expect(reasons).toEqual([
      "Below minimum match score (10 < 50)",
      "Below minimum match score (30 < 50)",
    ]);
  });

  it("settles only rows whose posting was read, never a search-row guess", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", "auto_apply", [
      { key: "a", matchScore: 90, threshold: 50 },
      { key: "d", matchScore: 30, threshold: 50 },
    ]);

    for (const update of state.jobUpdates) {
      expect(update.where.description).toEqual({ not: null });
    }
  });

  it("promotes rows of apply campaigns too, since pasted links are scored into them", async () => {
    const state = setup();
    await state.service.promoteScoredJobs("u1", "c1", "apply", [
      { key: "a", matchScore: 90, threshold: 50 },
    ]);

    expect(state.jobUpdates[0]?.where.campaign?.source?.in).toEqual(["auto_apply", "apply"]);
    expect(state.jobUpdates[0]?.data.status).toBe("approved");
  });
});
