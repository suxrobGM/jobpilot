// Lease grant path: a fake Prisma and CampaignJobService are injected into AgendaService, so lease
// grant/claim/verify logic runs with no database. Loading the service transitively loads `@/env`,
// satisfied by the local .env / ci.yml dummy env.

import { approvedJob, makeAgendaDeps, type Over } from "./db.test-helpers";
import { AgendaService } from "./service";
import { describe, expect, it } from "bun:test";

const service = (over: Over = {}) => {
  const { prisma, campaignJobs, pilot, push, campaigns, rec } = makeAgendaDeps(over);
  return { svc: new AgendaService(prisma, campaignJobs, pilot, push, campaigns), rec };
};

describe("AgendaService leasing", () => {
  it("grants a job.apply lease and flips the job to applying", async () => {
    const { svc, rec } = service({
      approvedJobs: [approvedJob()],
      job: {
        campaignId: "c1",
        key: "jobkey",
        status: "approved",
        title: "Engineer",
        url: "https://x/1",
      },
    });

    const lease = await svc.lease("p1", "job.apply:c1:jobkey");

    expect(rec.claimJobForApply[0]).toEqual(["p1", "c1", "jobkey"]);
    expect(rec.leaseCreates[0]).toMatchObject({
      kind: "job.apply",
      subjectType: "job",
      subjectId: "jobkey",
    });
    expect((lease.payload as { jobKey: string }).jobKey).toBe("jobkey");
  });

  it("409s when the leased item is no longer on the agenda", async () => {
    const { svc } = service({ approvedJobs: [] });
    expect(svc.lease("p1", "job.apply:c1:jobkey")).rejects.toThrow();
  });

  it("409s when the atomic approved->applying claim loses the race", async () => {
    const { svc } = service({
      approvedJobs: [approvedJob()],
      claimCount: 0,
      job: { status: "approved" },
    });
    expect(svc.lease("p1", "job.apply:c1:jobkey")).rejects.toThrow();
  });

  it("grants a promo.post lease only when the post is still approved", async () => {
    const { svc, rec } = service({
      approvedPromotions: [{ id: "P1", platform: "hn", target: null, title: null, body: "b" }],
      promoFindFirst: { id: "P1" },
    });
    const lease = await svc.lease("p1", "promo.post:P1");
    expect(rec.leaseCreates[0]).toMatchObject({ kind: "promo.post", subjectId: "P1" });
    expect(lease.subjectId).toBe("P1");
  });

  it("409s a promo.post lease when the post is no longer approved", async () => {
    const { svc } = service({
      approvedPromotions: [{ id: "P1", platform: "hn", target: null, title: null, body: "b" }],
      promoFindFirst: null,
    });
    expect(svc.lease("p1", "promo.post:P1")).rejects.toThrow();
  });

  const scorePendingOver: Over = {
    scorePendingCampaigns: [
      {
        campaignId: "c1",
        query: "react",
        config: "{}",
        jobs: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
      },
    ],
    scorePendingCounts: [{ campaignId: "c1", _count: { _all: 3 } }],
  };

  it("grants a campaign.scorePending lease while unscored pending rows remain", async () => {
    const { svc, rec } = service({ ...scorePendingOver, campaignFindFirst: { campaignId: "c1" } });
    const lease = await svc.lease("p1", "campaign.scorePending:c1");
    expect(rec.leaseCreates[0]).toMatchObject({
      kind: "campaign.scorePending",
      subjectType: "campaign",
      subjectId: "c1",
    });
    expect(lease.subjectId).toBe("c1");
  });

  it("409s a campaign.scorePending lease once no unscored pending rows are left", async () => {
    const { svc } = service({ ...scorePendingOver, campaignFindFirst: null });
    expect(svc.lease("p1", "campaign.scorePending:c1")).rejects.toThrow();
  });
});

describe("AgendaService lease lifecycle", () => {
  it("409s a heartbeat on an already-released lease and records no update", async () => {
    const { svc, rec } = service({ activeLease: { id: "L1", releasedAt: new Date() } });
    await expect(svc.heartbeat("p1", "L1")).rejects.toThrow();
    expect(rec.leaseUpdates).toHaveLength(0);
  });

  it("bumps heartbeatAt and expiresAt on a live lease", async () => {
    const { svc, rec } = service({ activeLease: { id: "L1", releasedAt: null } });
    await svc.heartbeat("p1", "L1");
    expect(rec.leaseUpdates[0]?.data).toHaveProperty("heartbeatAt");
    expect(rec.leaseUpdates[0]?.data).toHaveProperty("expiresAt");
  });

  it("409s a release on an already-released lease and records no update", async () => {
    const { svc, rec } = service({
      activeLease: { id: "L1", releasedAt: new Date(), payload: "{}" },
    });
    await expect(svc.release("p1", "L1", { outcome: "done" })).rejects.toThrow();
    expect(rec.leaseUpdates).toHaveLength(0);
  });
});
