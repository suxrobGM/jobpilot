import type { AgendaResponse } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { ClaimService } from "./claim.service";
import { describe, expect, it } from "bun:test";

const VERSION = "31b0c512-b767-4dd7-9ee8-913e46d544c6";
const now = new Date();
const snapshot: AgendaResponse = {
  version: VERSION,
  generatedAt: now,
  expiresAt: new Date(now.getTime() + 60_000),
  items: [
    {
      id: "job.apply:c1:j1",
      kind: "job.apply",
      priority: 100,
      title: "Engineer",
      subjectType: "job",
      subjectId: "j1",
      payload: {
        campaignId: "c1",
        jobKey: "j1",
        url: "https://example.test/job",
        board: null,
        digest: null,
        matchScore: 90,
      },
    },
  ],
  counts: { openQuestions: 0, activeClaims: 0, approvedJobs: 1, appliedToday: 0 },
  budget: { dailyApplyCap: 10, appliedToday: 0, capReached: false, resetsAt: now },
  emptyReason: null,
  sleepSeconds: 30,
  nextWakeAt: new Date(now.getTime() + 30_000),
};

function setup(version = VERSION, openClaim: { id: string } | null = null) {
  const creates: Record<string, unknown>[] = [];
  const locks: Record<string, unknown>[] = [];
  const db = {
    pilotState: {
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        locks.push(where);
        return { count: where.agendaVersion === version ? 1 : 0 };
      },
      findUnique: async () => ({
        enabled: true,
        agendaVersion: version,
        agendaSnapshot: snapshot,
        agendaExpiresAt: snapshot.expiresAt,
      }),
      findUniqueOrThrow: async () => ({
        enabled: true,
        agendaVersion: version,
        agendaSnapshot: snapshot,
        agendaExpiresAt: snapshot.expiresAt,
      }),
    },
    pilotClaim: {
      findFirst: async () => openClaim,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data);
        return {
          id: "4c965efd-b586-49ea-825b-1af715760116",
          grantedAt: now,
          heartbeatAt: null,
          releasedAt: null,
          outcome: null,
          ...data,
        };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const campaignJobs = {
    claimJobForApplyInTransaction: async () => ({ key: "j1" }),
    publishClaimedJob: () => undefined,
  } as unknown as CampaignJobService;
  return {
    service: new ClaimService(db as unknown as PrismaClient, campaignJobs),
    creates,
    locks,
  };
}

describe("ClaimService snapshots", () => {
  it("claims from the supplied snapshot version and persists the typed payload", async () => {
    const { service, creates, locks } = setup();
    const claim = await service.claim(
      "8d71b5f1-3a64-43b1-ac29-ebda08c7eba6",
      VERSION,
      "job.apply:c1:j1",
    );
    expect(creates[0]).toMatchObject({ kind: "job.apply", subjectId: "j1" });
    expect(locks[0]).toMatchObject({ enabled: true, agendaVersion: VERSION });
    expect(claim.payload).toMatchObject({ campaignId: "c1", jobKey: "j1" });
  });

  it("rejects a stale agenda version before creating a claim", async () => {
    const { service, creates } = setup("d6579e89-e9af-4f83-a04e-7d2cfad07cf3");
    await expect(service.claim("u1", VERSION, "job.apply:c1:j1")).rejects.toThrow("stale");
    expect(creates).toHaveLength(0);
  });

  it("rejects a subject that already holds an open claim", async () => {
    const { service, creates } = setup(VERSION, { id: "held" });
    await expect(service.claim("u1", VERSION, "job.apply:c1:j1")).rejects.toThrow(
      "already claimed",
    );
    expect(creates).toHaveLength(0);
  });
});
