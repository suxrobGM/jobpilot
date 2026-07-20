import type { CampaignStatus, PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "./campaign.service";
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
  const db = {
    campaign: {
      findMany: async () => [current],
      count: async () => 1,
      findFirst: async () => current,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...current, ...data }),
      findUniqueOrThrow: async () => ({ ...current, ...updates.at(-1) }),
    },
    job: { groupBy: async () => [] },
    networkingMessage: { groupBy: async () => [], findMany: async () => [] },
  };
  return { service: new CampaignService(db as unknown as PrismaClient), updates };
}

describe("CampaignService", () => {
  it("returns a paginated DTO with a derived summary", async () => {
    const { service } = makeService();
    const result = await service.list("u1", { page: 1, limit: 25 });
    expect(result.pagination).toMatchObject({ page: 1, limit: 25, total: 1, totalPages: 1 });
    expect(result.items[0]?.summary).toEqual({
      kind: "jobs",
      totalFound: 0,
      qualified: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
    });
  });

  it("applies an allowed status command", async () => {
    const { service, updates } = makeService();
    const result = await service.commandStatus("u1", "c1", { status: "paused" });
    expect(updates).toEqual([{ status: "paused", completedAt: null }]);
    expect(result.status).toBe("paused");
  });

  it("rejects a transition away from a terminal status", async () => {
    const { service } = makeService({ ...row, status: "completed" });
    await expect(service.commandStatus("u1", "c1", { status: "paused" })).rejects.toThrow();
  });

  it("keeps source-specific config invariants on full replacement", async () => {
    const { service } = makeService();
    await expect(service.updateConfig("u1", "c1", { config: {} })).rejects.toThrow(
      "config.resumeId is required",
    );
  });
});
