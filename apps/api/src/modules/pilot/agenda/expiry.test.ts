// Exercises the lazy expiry sweep in isolation via runExpiry with a fake Prisma + CampaignJobService,
// so no database is touched. Importing the campaign service transitively loads `@/env`, satisfied by
// the local .env / ci.yml dummy env.

import type { PrismaClient } from "@/generated/prisma/client";
import type { Over } from "./db.test-helpers";
import { makeAgendaDb, makeCampaignJobs } from "./db.test-helpers";
import { runExpiry } from "./expiry";
import { describe, expect, it } from "bun:test";

const sweep = (over: Over) => {
  const { db, rec } = makeAgendaDb(over);
  const deps = { prisma: db as unknown as PrismaClient, campaignJobs: makeCampaignJobs(rec, over) };
  return { run: () => runExpiry(deps, "p1", new Date()), rec };
};

describe("AgendaService lazy expiry", () => {
  it("reverts an applying job to approved when its lease has expired", async () => {
    const { run, rec } = sweep({
      expiredLeases: [
        {
          id: "L1",
          kind: "job.apply",
          subjectId: "jobkey",
          payload: JSON.stringify({ campaignId: "c1", jobKey: "jobkey" }),
        },
      ],
      job: { status: "applying" },
    });

    await run();

    expect(rec.leaseUpdates[0].data).toMatchObject({ outcome: "expired" });
    expect(rec.patchJob[0]).toEqual(["p1", "c1", "jobkey", { status: "approved" }]);
  });

  it("skips a parked job when its question expires", async () => {
    const { run, rec } = sweep({
      expiredQuestions: [{ id: "E1", subjectType: "job", subjectId: "c1:jobkey" }],
      job: { status: "needs_user" },
    });

    await run();

    expect(rec.questionUpdates[0].data).toMatchObject({ status: "expired" });
    expect(rec.recordResult[0]?.[0]).toBe("p1");
    expect(rec.recordResult[0]?.[3]).toMatchObject({ outcome: "skipped" });
  });
});
