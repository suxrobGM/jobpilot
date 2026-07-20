// Exercises promoteScoredPendingJobs in isolation via a fake Prisma + CampaignJobService, so no
// database is touched. Importing the campaign service transitively loads `@/env`, satisfied by the
// local .env / ci.yml dummy env.

import type { PrismaClient } from "@/generated/prisma/client";
import type { Over } from "./db.test-helpers";
import { makeAgendaDb, makeCampaignJobs } from "./db.test-helpers";
import { promoteScoredPendingJobs } from "./promote";
import { describe, expect, it } from "bun:test";

const scored = (over: Record<string, unknown> = {}) => ({
  campaignId: "c1",
  key: "jobkey",
  matchScore: 80,
  campaign: { config: "{}" },
  ...over,
});

const run = (over: Over, fallbackMinScore = 60) => {
  const { db, rec } = makeAgendaDb(over);
  const deps = { prisma: db as unknown as PrismaClient, campaignJobs: makeCampaignJobs(rec, over) };
  return { go: () => promoteScoredPendingJobs(deps, "p1", fallbackMinScore), rec };
};

describe("promoteScoredPendingJobs", () => {
  it("promotes a pending job at/above the fallback threshold to approved", async () => {
    const { go, rec } = run({ scoredPendingJobs: [scored({ matchScore: 75 })] });
    await go();
    expect(rec.patchJob[0]).toEqual(["p1", "c1", "jobkey", { status: "approved" }]);
    expect(rec.recordResult).toHaveLength(0);
  });

  it("skips a pending job below the threshold with the score in the reason", async () => {
    const { go, rec } = run({ scoredPendingJobs: [scored({ matchScore: 40 })] });
    await go();
    expect(rec.patchJob).toHaveLength(0);
    expect(rec.recordResult[0]).toEqual([
      "p1",
      "c1",
      "jobkey",
      { outcome: "skipped", skipReason: "Below minimum match score (40 < 60)" },
    ]);
  });

  it("prefers the campaign's own minScore over the fallback", async () => {
    const { go, rec } = run({
      // Score 75 clears the fallback 60 but not the campaign's 80, so it is skipped against 80.
      scoredPendingJobs: [scored({ matchScore: 75, campaign: { config: '{"minScore":80}' } })],
    });
    await go();
    expect(rec.patchJob).toHaveLength(0);
    expect(rec.recordResult[0]?.[3]).toMatchObject({
      skipReason: "Below minimum match score (75 < 80)",
    });
  });

  it("does nothing when there are no scored pending jobs", async () => {
    const { go, rec } = run({ scoredPendingJobs: [] });
    await go();
    expect(rec.patchJob).toHaveLength(0);
    expect(rec.recordResult).toHaveLength(0);
  });
});
