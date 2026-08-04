import type { CampaignStatus, PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "./campaign.service";
import { emptyJobSummary } from "./campaign.summary";
import { describe, expect, it } from "bun:test";

const row = {
  campaignId: "c1",
  userId: "u1",
  query: "typescript",
  source: "search" as const,
  status: "in_progress" as CampaignStatus,
  startedAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  config: {},
};

function makeService(current = row) {
  const updates: Record<string, unknown>[] = [];
  const wheres: Record<string, unknown>[] = [];
  const jobBatches: Record<string, unknown>[][] = [];
  const db = {
    campaign: {
      findMany: async () => [current],
      count: async () => 1,
      findFirst: async () => current,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...current, ...data }),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        wheres.push(where);
        // Mirror the DB: a guarded column that doesn't match the row updates nothing.
        const guard = where.updatedAt;
        if (guard instanceof Date && guard.getTime() !== current.updatedAt.getTime()) {
          return { count: 0 };
        }
        updates.push(data);
        return { count: 1 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...current, ...data }),
      findUniqueOrThrow: async () => ({ ...current, ...updates.at(-1) }),
    },
    job: {
      groupBy: async () => [],
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        jobBatches.push(data);
        return { count: data.length };
      },
    },
    networkingMessage: { groupBy: async () => [], findMany: async () => [] },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  return {
    service: new CampaignService(db as unknown as PrismaClient),
    updates,
    wheres,
    jobBatches,
  };
}

describe("CampaignService", () => {
  it("returns a paginated DTO with a derived summary", async () => {
    const { service } = makeService();
    const result = await service.list("u1", { page: 1, limit: 25 });
    expect(result.pagination).toMatchObject({ page: 1, limit: 25, total: 1, totalPages: 1 });
    expect(result.items[0]?.summary).toEqual(emptyJobSummary());
  });

  it("applies an allowed status command with actor attribution", async () => {
    const { service, updates } = makeService();
    const result = await service.commandStatus("u1", "c1", {
      status: "paused",
      actor: "agent",
      reason: "verification required",
    });
    expect(updates).toEqual([
      {
        status: "paused",
        statusActor: "agent",
        statusReason: "verification required",
        completedAt: null,
      },
    ]);
    expect(result.status).toBe("paused");
  });

  it("rejects a transition away from a terminal status", async () => {
    const { service } = makeService({ ...row, status: "completed" });
    await expect(
      service.commandStatus("u1", "c1", { status: "paused", actor: "user" }),
    ).rejects.toThrow();
  });

  it("keeps source-specific config invariants on full replacement", async () => {
    const { service } = makeService();
    await expect(service.updateConfig("u1", "c1", { config: {} })).rejects.toThrow(
      "config.resumeId is required",
    );
  });

  it("scopes a config write to the owner and the expected version", async () => {
    const { service, wheres } = makeService();
    await service.updateConfig("u1", "c1", {
      config: { resumeId: "b0f1c2d3-4e5a-4b6c-8d7e-9f0a1b2c3d4e" },
      expectedUpdatedAt: row.updatedAt.toISOString(),
    });
    expect(wheres.at(-1)).toEqual({
      campaignId: "c1",
      userId: "u1",
      updatedAt: row.updatedAt,
    });
  });

  it("rejects a config write whose expected version is stale", async () => {
    const { service } = makeService();
    await expect(
      service.updateConfig("u1", "c1", {
        config: { resumeId: "b0f1c2d3-4e5a-4b6c-8d7e-9f0a1b2c3d4e" },
        expectedUpdatedAt: new Date(row.updatedAt.getTime() - 1000).toISOString(),
      }),
    ).rejects.toThrow("Campaign changed since it was fetched");
  });

  it("still scopes a config write to the owner when no version is expected", async () => {
    const { service, wheres } = makeService();
    await service.updateConfig("u1", "c1", {
      config: { resumeId: "b0f1c2d3-4e5a-4b6c-8d7e-9f0a1b2c3d4e" },
    });
    expect(wheres.at(-1)).toEqual({ campaignId: "c1", userId: "u1" });
  });
});

describe("CampaignService create with pasted urls", () => {
  const create = (urls: string[]) => ({
    query: "Pasted links",
    source: "apply" as const,
    createdBy: "user" as const,
    urls,
  });

  it("seeds each link as a queued job titled by its host, with no company yet", async () => {
    const { service, jobBatches } = makeService();
    await service.create("u1", create(["https://boards.acme.test/jobs/1"]));
    expect(jobBatches[0]).toEqual([
      {
        campaignId: "c1",
        key: expect.any(String),
        title: "boards.acme.test",
        company: "",
        url: "https://boards.acme.test/jobs/1",
        status: "queued",
      },
    ]);
  });

  it("counts the queued rows into the returned summary", async () => {
    const { service } = makeService();
    const campaign = await service.create(
      "u1",
      create(["https://x.test/1", "https://x.test/2", "https://x.test/3"]),
    );
    expect(campaign.summary).toMatchObject({
      kind: "jobs",
      totalFound: 3,
      byStatus: { queued: 3 },
    });
  });

  it("dedupes a repeated link so one paste cannot queue it twice", async () => {
    const { service, jobBatches } = makeService();
    const campaign = await service.create(
      "u1",
      create(["https://x.test/1", "https://x.test/1", "https://x.test/2"]),
    );
    expect(jobBatches[0]?.map((j) => j.url)).toEqual(["https://x.test/1", "https://x.test/2"]);
    expect(campaign.summary).toMatchObject({ totalFound: 2 });
  });

  it("seeds every link in one bulk write, so a half-written batch cannot strand them", async () => {
    const { service, jobBatches } = makeService();
    await service.create("u1", create(["https://x.test/1", "https://x.test/2"]));
    expect(jobBatches).toHaveLength(1);
  });
});
