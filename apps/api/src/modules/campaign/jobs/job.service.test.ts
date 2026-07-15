// Like admin.guard.test.ts, importing the service transitively loads `@/env`, so this needs the dummy
// env block in ci.yml - but it issues NO real query: a fake Prisma is injected and the $transaction
// callback runs against it. That keeps `recordJobResult`'s branch logic under test with no database.
import type { CampaignJobResultInput } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import type { JobListingIngestService } from "@/modules/job-listing";
import { normalizeCompanyName, normalizeJobTitle } from "@/modules/scoring/applied-duplicates";
import { CampaignJobService } from "./job.service";
import { beforeEach, describe, expect, it } from "bun:test";

const PROFILE = "profile-1";
const CAMPAIGN = "campaign-1";
const KEY = "job-key-1";

const baseJob = {
  id: 1,
  campaignId: CAMPAIGN,
  key: KEY,
  title: "Senior Frontend Engineer",
  company: "Acme Inc",
  location: "Remote",
  salary: null,
  type: null,
  url: "https://acme.example/jobs/1",
  board: "greenhouse",
  matchScore: 88,
  matchReason: "strong overlap",
  status: "applying",
  failReason: null,
  skipReason: null,
  retryNotes: null,
  description: null,
  digest: null,
  appliedAt: null,
};

interface Recorder {
  applicationCreateCount: number;
  applicationCreate?: Record<string, unknown>;
  queueUpdate?: { data: Record<string, unknown> };
  jobUpdate?: { data: Record<string, unknown> };
  jobUpdateMany?: { where: Record<string, unknown>; data: Record<string, unknown> };
  groupByCount: number;
}

function makeDb(existingApplication: Record<string, unknown> | null = null, claimCount = 1) {
  const rec: Recorder = { applicationCreateCount: 0, groupByCount: 0 };
  const db = {
    job: {
      findFirst: async () => ({ ...baseJob, campaign: { source: "auto-apply", summary: "{}" } }),
      findUniqueOrThrow: async () => ({ ...baseJob, status: "applying" }),
      update: async (args: { data: Record<string, unknown> }) => {
        rec.jobUpdate = args;
        return { ...baseJob, ...args.data };
      },
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        rec.jobUpdateMany = args;
        return { count: claimCount };
      },
      groupBy: async () => {
        rec.groupByCount += 1;
        return [{ status: "applied", _count: { _all: 1 } }];
      },
    },
    application: {
      findUnique: async () => existingApplication,
      create: async (args: { data: Record<string, unknown> }) => {
        rec.applicationCreate = args.data;
        rec.applicationCreateCount += 1;
        return { id: "app-created", ...args.data };
      },
    },
    queueEntry: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        rec.queueUpdate = args;
        return { count: 1 };
      },
    },
    campaign: { update: async () => ({}) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return { db, rec };
}

const listings = { ingestInBackground() {} } as unknown as JobListingIngestService;

const service = (db: unknown) => new CampaignJobService(db as unknown as PrismaClient, listings);

const APPLIED_AT = "2026-07-15T10:00:00.000Z";
const input = (over: Partial<CampaignJobResultInput>): CampaignJobResultInput =>
  ({ outcome: "applied", appliedAt: APPLIED_AT, ...over }) as CampaignJobResultInput;

describe("recordJobResult", () => {
  let db: ReturnType<typeof makeDb>["db"];
  let rec: Recorder;

  beforeEach(() => {
    ({ db, rec } = makeDb());
  });

  it("applied: updates the job, creates an Application, and consumes the queue entry", async () => {
    const result = await service(db).recordJobResult(
      PROFILE,
      CAMPAIGN,
      KEY,
      input({ matchScore: 90 }),
    );

    expect(result.campaignJob.status).toBe("applied");
    expect(result.campaignJob.appliedAt).toEqual(new Date(APPLIED_AT));

    expect(rec.applicationCreateCount).toBe(1);
    expect(rec.applicationCreate).toMatchObject({
      profileId: PROFILE,
      url: baseJob.url,
      source: "auto-apply",
      normalizedTitle: normalizeJobTitle(baseJob.title),
      normalizedCompany: normalizeCompanyName(baseJob.company),
    });
    expect(rec.applicationCreate?.appliedAt).toEqual(new Date(APPLIED_AT));
    expect(result.application).toMatchObject({ id: "app-created" });

    // Terminal-but-not-skipped outcomes consume the pending queue entry.
    expect(rec.queueUpdate?.data).toMatchObject({ status: "consumed" });
    expect(rec.queueUpdate?.data.consumedAt).toBeInstanceOf(Date);

    expect(result.summary.applied).toBe(1);

    // The shared emit path reuses the transaction-computed summary; it must not recompute.
    expect(rec.groupByCount).toBe(1);
  });

  it("applied with an existing Application: reuses it instead of creating a duplicate", async () => {
    const { db: db2, rec: rec2 } = makeDb({ id: "app-existing", url: baseJob.url });

    const result = await service(db2).recordJobResult(PROFILE, CAMPAIGN, KEY, input({}));

    expect(rec2.applicationCreateCount).toBe(0);
    expect(result.application?.id).toBe("app-existing");
  });

  it("skipped: marks the queue entry skipped and creates no Application", async () => {
    const result = await service(db).recordJobResult(
      PROFILE,
      CAMPAIGN,
      KEY,
      input({ outcome: "skipped", appliedAt: undefined, skipReason: "not a fit" }),
    );

    expect(result.campaignJob.status).toBe("skipped");
    expect(rec.applicationCreateCount).toBe(0);
    expect(result.application).toBeNull();
    expect(rec.queueUpdate?.data).toMatchObject({ status: "skipped", consumedAt: null });
  });

  it("failed: consumes the queue entry and creates no Application", async () => {
    const result = await service(db).recordJobResult(
      PROFILE,
      CAMPAIGN,
      KEY,
      input({ outcome: "failed", appliedAt: undefined, failReason: "form error" }),
    );

    expect(result.campaignJob.status).toBe("failed");
    expect(rec.applicationCreateCount).toBe(0);
    expect(result.application).toBeNull();
    expect(rec.queueUpdate?.data).toMatchObject({ status: "consumed" });
  });
});

describe("claimJobForApply", () => {
  it("claims an approved job, flips it to applying, and recomputes the summary", async () => {
    const { db, rec } = makeDb();

    const row = await service(db).claimJobForApply(PROFILE, CAMPAIGN, KEY);

    // The conditional claim only matches an approved row, guarding the single-writer invariant.
    expect(rec.jobUpdateMany?.where).toMatchObject({ status: "approved", key: KEY });
    expect(rec.jobUpdateMany?.data).toEqual({ status: "applying" });
    expect(row.status).toBe("applying");
    // Emission parity with patchJob: the shared path recomputes the campaign summary.
    expect(rec.groupByCount).toBe(1);
  });

  it("409s when the row is no longer approved (claim matched zero rows)", async () => {
    const { db } = makeDb(null, 0);
    expect(service(db).claimJobForApply(PROFILE, CAMPAIGN, KEY)).rejects.toThrow();
  });
});
