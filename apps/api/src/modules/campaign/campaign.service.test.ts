// Exercises reconcileStaleCampaigns (via the public list path) and selfHealForPilot with a fake
// Prisma, so no database is touched. Importing the service transitively loads `@/env`, satisfied by
// the local .env / ci.yml dummy env.

import type { PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "./campaign.service";
import { describe, expect, it } from "bun:test";

const MINUTE = 60 * 1000;

interface Over {
  enabled?: boolean;
  interrupted?: { campaignId: string; source: string }[];
  candidates?: { campaignId: string; source: string; updatedAt: Date }[];
}

interface Rec {
  campaignUpdateMany: { data: Record<string, unknown> }[];
  jobUpdateMany: { data: Record<string, unknown> }[];
}

function makeDb(over: Over) {
  const rec: Rec = { campaignUpdateMany: [], jobUpdateMany: [] };
  const db = {
    pilotState: {
      findUnique: async () => (over.enabled === undefined ? null : { enabled: over.enabled }),
    },
    campaign: {
      findMany: async (a: { where: { status?: string; updatedAt?: { lt: Date } } }) => {
        if (a.where.status === "interrupted") return over.interrupted ?? [];
        if (a.where.updatedAt != null) {
          const cutoff = a.where.updatedAt.lt;
          return (over.candidates ?? []).filter((c) => c.updatedAt < cutoff);
        }
        return [];
      },
      updateMany: (a: { data: Record<string, unknown> }) => {
        rec.campaignUpdateMany.push(a);
        return Promise.resolve({ count: 1 });
      },
    },
    job: {
      updateMany: (a: { data: Record<string, unknown> }) => {
        rec.jobUpdateMany.push(a);
        return Promise.resolve({ count: 1 });
      },
    },
    // Flip runs its two updateMany calls in a transaction (array form): await them all.
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { db, rec };
}

const service = (over: Over) => {
  const { db, rec } = makeDb(over);
  return { svc: new CampaignService(db as unknown as PrismaClient), rec };
};

describe("CampaignService reconcile (pilot enabled)", () => {
  it("never flips and self-heals interrupted auto-apply campaigns back to in_progress", async () => {
    const { svc, rec } = service({
      enabled: true,
      interrupted: [{ campaignId: "c1", source: "auto-apply" }],
    });

    await svc.list("p1", {});

    expect(rec.campaignUpdateMany).toHaveLength(1);
    expect(rec.campaignUpdateMany[0]?.data).toEqual({ status: "in_progress" });
    // No flip-to-interrupted and no applying-revert under an enabled pilot.
    expect(rec.jobUpdateMany).toHaveLength(0);
  });

  it("selfHealForPilot is a no-op when nothing is interrupted", async () => {
    const { svc, rec } = service({ enabled: true, interrupted: [] });
    const healed = await svc.selfHealForPilot("p1");
    expect(healed).toBe(0);
    expect(rec.campaignUpdateMany).toHaveLength(0);
  });

  it("selfHealForPilot does nothing when the pilot is disabled", async () => {
    const { svc, rec } = service({
      enabled: false,
      interrupted: [{ campaignId: "c1", source: "auto-apply" }],
    });
    const healed = await svc.selfHealForPilot("p1");
    expect(healed).toBe(0);
    expect(rec.campaignUpdateMany).toHaveLength(0);
  });
});

describe("CampaignService reconcile (pilot off)", () => {
  it("flips a 16-minute-stale campaign to interrupted and reverts its applying jobs", async () => {
    const { svc, rec } = service({
      enabled: false,
      candidates: [
        { campaignId: "c1", source: "auto-apply", updatedAt: new Date(Date.now() - 16 * MINUTE) },
      ],
    });

    await svc.list("p1", {});

    expect(rec.campaignUpdateMany[0]?.data).toEqual({ status: "interrupted" });
    expect(rec.jobUpdateMany[0]?.data).toEqual({ status: "approved" });
  });

  it("leaves a 10-minute-old campaign untouched (within the 15-minute threshold)", async () => {
    const { svc, rec } = service({
      enabled: false,
      candidates: [
        { campaignId: "c1", source: "auto-apply", updatedAt: new Date(Date.now() - 10 * MINUTE) },
      ],
    });

    await svc.list("p1", {});

    expect(rec.campaignUpdateMany).toHaveLength(0);
    expect(rec.jobUpdateMany).toHaveLength(0);
  });
});
