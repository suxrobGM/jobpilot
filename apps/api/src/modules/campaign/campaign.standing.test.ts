import type { CreateCampaignInput } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import { CampaignService } from "./campaign.service";
import { describe, expect, it } from "bun:test";

const OLD_RESUME = "0f4b6a52-7c1e-4d8a-9b3f-2e5c6d7a8b90";
const NEW_RESUME = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const standing = {
  id: "c-open",
  userId: "u1",
  query: "Job alerts",
  source: "auto_apply" as const,
  status: "in_progress" as const,
  createdBy: "pilot" as const,
  feed: "job_alerts" as const,
  startedAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  board: null,
  config: { resumeId: OLD_RESUME, minScore: 80 },
};

interface FakeOptions {
  open: typeof standing | null;
  raceOnCreate?: boolean;
}

function makeService({ open, raceOnCreate = false }: FakeOptions) {
  const created: Record<string, unknown>[] = [];
  const configWrites: Record<string, unknown>[] = [];
  const db = {
    campaign: {
      findFirst: async () => open,
      findFirstOrThrow: async () => ({ ...standing, id: "c-winner" }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (raceOnCreate) throw Object.assign(new Error("unique"), { code: "P2002" });
        created.push(data);
        return { ...standing, ...data, id: "c-new" };
      },
      update: async ({ data }: { data: { config: Record<string, unknown> } }) => {
        configWrites.push(data.config);
        return { ...standing, config: data.config };
      },
    },
    campaignJob: { groupBy: async () => [] },
    networkingMessage: { groupBy: async () => [] },
  };
  return {
    service: new CampaignService(db as unknown as PrismaClient, makeBoards()),
    created,
    configWrites,
  };
}

const alertsBody = (resumeId: string): CreateCampaignInput => ({
  query: "Job alerts",
  source: "auto_apply",
  createdBy: "pilot",
  feed: "job_alerts",
  config: { resumeId, minScore: 70 },
});

describe("CampaignService create for a standing feed", () => {
  it("returns the feed's open campaign instead of creating one", async () => {
    const { service, created } = makeService({ open: standing });
    const campaign = await service.create("u1", alertsBody(OLD_RESUME));
    expect(campaign.id).toBe("c-open");
    expect(created).toEqual([]);
  });

  it("refreshes the resume but keeps the tuned minScore", async () => {
    const { service, configWrites } = makeService({ open: standing });
    const campaign = await service.create("u1", alertsBody(NEW_RESUME));
    expect(configWrites).toEqual([{ resumeId: NEW_RESUME, minScore: 80 }]);
    expect(campaign.config).toEqual({ resumeId: NEW_RESUME, minScore: 80 });
  });

  it("creates the standing campaign when none is open", async () => {
    const { service, created } = makeService({ open: null });
    const campaign = await service.create("u1", alertsBody(OLD_RESUME));
    expect(campaign.id).toBe("c-new");
    expect(created[0]).toMatchObject({ feed: "job_alerts", pilotSearchId: null });
  });

  it("returns the race winner when a concurrent create took the unique index", async () => {
    const { service } = makeService({ open: null, raceOnCreate: true });
    const campaign = await service.create("u1", alertsBody(OLD_RESUME));
    expect(campaign.id).toBe("c-winner");
  });
});
