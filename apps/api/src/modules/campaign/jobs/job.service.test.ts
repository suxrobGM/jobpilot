import type { PrismaClient } from "@/generated/prisma/client";
import type { JobListingPublisher } from "@/modules/job-listing";
import { CampaignJobService } from "./job.service";
import { describe, expect, it } from "bun:test";

const APPLIED_AT = "2026-07-20T12:00:00.000Z";

function setup() {
  let job = {
    id: "j-id",
    campaignId: "c1",
    key: "j1",
    title: "Engineer",
    company: "Acme",
    location: null,
    salary: null,
    type: null,
    url: "https://example.test/jobs/1",
    board: "example",
    matchScore: 90,
    matchReason: "fit",
    status: "applying",
    appliedAt: null,
    failReason: null,
    retryNotes: null,
    skipReason: null,
    description: null,
    digest: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let application: Record<string, unknown> | null = null;
  let applicationUpserts = 0;
  const variantLinks: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const campaign = { source: "auto_apply" as const };
  const db = {
    job: {
      findFirst: async () => ({ ...job, campaign }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { status?: unknown };
        data: Record<string, unknown>;
      }) => {
        if (where.status && typeof where.status === "object" && "notIn" in where.status) {
          if (["applied", "failed", "skipped"].includes(job.status)) return { count: 0 };
        } else if (typeof where.status === "string" && job.status !== where.status) {
          return { count: 0 };
        }
        job = { ...job, ...data } as typeof job;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => job,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        job = { ...job, ...data } as typeof job;
        return job;
      },
      groupBy: async () => [
        { campaignId: job.campaignId, status: job.status, _count: { _all: 1 } },
      ],
    },
    application: {
      findUnique: async () => application,
      findMany: async () => (application ? [application] : []),
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        applicationUpserts += 1;
        application = { id: "app1", ...create };
        return application;
      },
    },
    resumeVariant: {
      updateMany: async (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        variantLinks.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const listings = { publishInBackground: () => undefined } as unknown as JobListingPublisher;
  return {
    service: new CampaignJobService(db as unknown as PrismaClient, listings),
    get job() {
      return job;
    },
    get applicationUpserts() {
      return applicationUpserts;
    },
    variantLinks,
    setStatus(status: string) {
      job = { ...job, status };
    },
    setApplication(row: Record<string, unknown>) {
      application = row;
    },
  };
}

describe("CampaignJobService terminal results", () => {
  it("atomically records an application and its first event", async () => {
    const state = setup();
    const result = await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "applied",
      appliedAt: APPLIED_AT,
    });
    expect(result.campaignJob.status).toBe("applied");
    expect(result.application).toMatchObject({
      events: { create: { kind: "status_change", toStatus: "applied", source: "campaign" } },
    });
    expect(result.summary).toMatchObject({ kind: "jobs", applied: 1 });
  });

  it("links the job's tailored resume variants to the new application", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "applied",
      appliedAt: APPLIED_AT,
    });
    // The only thing tying a variant to an outcome. Scoped by owner+url, fills an unset link only.
    expect(state.variantLinks).toHaveLength(1);
    expect(state.variantLinks[0]).toMatchObject({
      where: {
        jobUrl: "https://example.test/jobs/1",
        applicationId: null,
        resume: { userId: "u1" },
      },
      data: { applicationId: "app1" },
    });
  });

  it("does not link variants when the job was not applied to", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "skipped",
      skipReason: "Already applied (url)",
    });
    expect(state.variantLinks).toHaveLength(0);
  });

  it("returns the same result idempotently without a second application upsert", async () => {
    const state = setup();
    const input = { outcome: "applied" as const, appliedAt: APPLIED_AT };
    await state.service.recordJobResult("u1", "c1", "j1", input);
    await state.service.recordJobResult("u1", "c1", "j1", input);
    expect(state.applicationUpserts).toBe(1);
  });

  it("rejects a different outcome after the job is terminal", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "failed",
      failReason: "blocked",
    });
    await expect(
      state.service.recordJobResult("u1", "c1", "j1", {
        outcome: "skipped",
        skipReason: "duplicate",
      }),
    ).rejects.toThrow("already finished");
  });

  it("does not allow PATCH to rewrite an applied job", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "applied",
      appliedAt: APPLIED_AT,
    });
    await expect(
      state.service.patchJob("u1", "c1", "j1", { description: "late edit" }),
    ).rejects.toThrow("Terminal jobs cannot be edited");
  });

  it("retries a failed job only through the explicit retry command", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "failed",
      failReason: "timeout",
    });
    const retried = await state.service.retryJob("u1", "c1", "j1", {
      retryNotes: "Try after login refresh",
    });
    expect(retried).toMatchObject({
      status: "approved",
      failReason: null,
      retryNotes: "Try after login refresh",
    });
  });

  it("rescans a skipped job only through the explicit rescan command", async () => {
    const state = setup();
    await state.service.recordJobResult("u1", "c1", "j1", {
      outcome: "skipped",
      skipReason: "Old score",
    });
    const rescanned = await state.service.rescanJob("u1", "c1", "j1", {
      decision: "approved",
      matchScore: 88,
      matchReason: "Fresh posting supports the match",
    });
    expect(rescanned).toMatchObject({
      status: "approved",
      matchScore: 88,
      skipReason: null,
    });
  });
});

describe("CampaignJobService queued rows", () => {
  it("promotes a scored pasted link from queued to pending", async () => {
    const state = setup();
    state.setStatus("queued");
    const patched = await state.service.patchJob("u1", "c1", "j1", {
      status: "pending",
      title: "Staff Engineer",
      company: "Acme",
    });
    expect(patched).toMatchObject({ status: "pending", title: "Staff Engineer", company: "Acme" });
  });

  it("refuses to skip the score pass by approving a queued row outright", async () => {
    const state = setup();
    state.setStatus("queued");
    await expect(state.service.patchJob("u1", "c1", "j1", { status: "approved" })).rejects.toThrow(
      "cannot transition from queued to approved",
    );
  });
});

// Both routes into `applying` have to refuse a job this profile already applied to - the agent's
// own `/applied/check` call is advice it can skip, and by the browser step it is already too late.
describe("CampaignJobService duplicate apply guard", () => {
  const EXISTING = {
    id: "app-1",
    url: "https://example.test/jobs/1",
    title: "Engineer",
    company: "Acme",
    appliedAt: new Date(APPLIED_AT),
    status: "applied",
  };

  it("blocks the campaign PATCH into applying", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.service.patchJob("u1", "c1", "j1", { status: "applying" })).rejects.toThrow(
      /Already applied/,
    );
    expect(state.job.status).toBe("approved");
  });

  it("blocks the pilot claim", async () => {
    const state = setup();
    state.setStatus("approved");
    state.setApplication(EXISTING);

    await expect(state.service.claimJobForApply("u1", "c1", "j1")).rejects.toThrow(
      /Already applied/,
    );
    expect(state.job.status).toBe("approved");
  });

  it("still lets a job through when nothing matches", async () => {
    const state = setup();
    state.setStatus("approved");

    const patched = await state.service.patchJob("u1", "c1", "j1", { status: "applying" });

    expect(patched).toMatchObject({ status: "applying" });
  });
});
