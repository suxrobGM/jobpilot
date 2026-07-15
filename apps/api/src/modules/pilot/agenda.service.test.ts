// Like job.service.test.ts, importing the service transitively loads `@/env` (via CampaignJobService),
// so this relies on the local .env / ci.yml dummy env. It issues NO real query: a fake Prisma and a
// fake CampaignJobService are injected, so lease grant/expiry branch logic runs with no database.
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { AgendaService } from "./agenda.service";
import { describe, expect, it } from "bun:test";

interface Recorder {
  patchJob: unknown[][];
  recordResult: unknown[][];
  claimJobForApply: unknown[][];
  leaseCreates: Record<string, unknown>[];
  leaseUpdates: { data: Record<string, unknown> }[];
  escalationUpdates: { data: Record<string, unknown> }[];
}

interface Over {
  mandateConfig?: string;
  expiredLeases?: Record<string, unknown>[];
  escalationLeases?: { subjectId: string }[];
  expiredEscalations?: Record<string, unknown>[];
  answered?: Record<string, unknown>[];
  approvedJobs?: Record<string, unknown>[];
  appliedToday?: number;
  activeLeases?: number;
  finalizeCampaigns?: Record<string, unknown>[];
  job?: Record<string, unknown> | null;
  claimCount?: number;
}

function makeDb(over: Over = {}) {
  const rec: Recorder = {
    patchJob: [],
    recordResult: [],
    claimJobForApply: [],
    leaseCreates: [],
    leaseUpdates: [],
    escalationUpdates: [],
  };

  const db = {
    pilotState: {
      upsert: async () => ({ mandateConfig: over.mandateConfig ?? "{}" }),
    },
    pilotLease: {
      findMany: async (args: { where: { subjectType?: string } }) =>
        args.where.subjectType === "escalation"
          ? (over.escalationLeases ?? [])
          : (over.expiredLeases ?? []),
      count: async () => over.activeLeases ?? 0,
      findFirst: async () => null,
      update: async (a: { data: Record<string, unknown> }) => {
        rec.leaseUpdates.push(a);
        return {};
      },
      updateMany: async (a: { data: Record<string, unknown> }) => {
        rec.leaseUpdates.push(a);
        return { count: (over.expiredLeases ?? []).length };
      },
      create: async (a: { data: Record<string, unknown> }) => {
        rec.leaseCreates.push(a.data);
        return {
          id: "lease-1",
          grantedAt: new Date(),
          heartbeatAt: null,
          releasedAt: null,
          outcome: null,
          ...a.data,
        };
      },
    },
    escalation: {
      count: async () => 0,
      findMany: async (args: { where: { status?: string } }) =>
        args.where.status === "answered" ? (over.answered ?? []) : (over.expiredEscalations ?? []),
      update: async (a: { data: Record<string, unknown> }) => {
        rec.escalationUpdates.push(a);
        return {};
      },
      updateMany: async (a: { data: Record<string, unknown> }) => {
        rec.escalationUpdates.push(a);
        return { count: (over.expiredEscalations ?? []).length };
      },
    },
    job: {
      findMany: async () => over.approvedJobs ?? [],
      findFirst: async () => over.job ?? null,
      update: async () => ({}),
      groupBy: async () => [],
    },
    application: { count: async () => over.appliedToday ?? 0 },
    campaign: { findMany: async () => over.finalizeCampaigns ?? [], update: async () => ({}) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };

  const campaignJobs = {
    patchJob: async (...a: unknown[]) => {
      rec.patchJob.push(a);
    },
    recordJobResult: async (...a: unknown[]) => {
      rec.recordResult.push(a);
    },
    // Fake of the single-writer claim: throws on a lost race so lease() surfaces the 409.
    claimJobForApply: async (...a: unknown[]) => {
      rec.claimJobForApply.push(a);
      if ((over.claimCount ?? 1) === 0) {
        throw new Error("Job is no longer approved.");
      }
    },
  } as unknown as CampaignJobService;

  return { db, campaignJobs, rec };
}

const service = (over: Over = {}) => {
  const { db, campaignJobs, rec } = makeDb(over);
  return { svc: new AgendaService(db as unknown as PrismaClient, campaignJobs), rec };
};

const approvedJob = (over: Record<string, unknown> = {}) => ({
  campaignId: "c1",
  key: "jobkey",
  title: "Engineer",
  url: "https://x/1",
  board: null,
  digest: null,
  matchScore: 80,
  campaign: { config: "{}" },
  ...over,
});

describe("AgendaService lazy expiry", () => {
  it("reverts an applying job to approved when its lease has expired", async () => {
    const { svc, rec } = service({
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

    await svc.compile("p1");

    expect(rec.leaseUpdates[0].data).toMatchObject({ outcome: "expired" });
    expect(rec.patchJob[0]).toEqual(["p1", "c1", "jobkey", { status: "approved" }]);
  });

  it("skips a parked job when its escalation expires", async () => {
    const { svc, rec } = service({
      expiredEscalations: [{ id: "E1", subjectType: "job", subjectId: "c1:jobkey" }],
      job: { status: "needs_user" },
    });

    await svc.compile("p1");

    expect(rec.escalationUpdates[0].data).toMatchObject({ status: "expired" });
    expect(rec.recordResult[0]?.[0]).toBe("p1");
    expect(rec.recordResult[0]?.[3]).toMatchObject({ outcome: "skipped" });
  });
});

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
});

describe("AgendaService escalation consumption", () => {
  it("keeps an answered escalation on the agenda until a lease references it", async () => {
    const { svc } = service({
      answered: [{ id: "E1", kind: "question", question: "Which date?" }],
    });
    const agenda = await svc.compile("p1");
    expect(agenda.items.map((i) => i.kind)).toContain("escalation.answered");
  });

  it("drops an answered escalation once a lease has referenced it", async () => {
    const { svc } = service({
      answered: [{ id: "E1", kind: "question", question: "Which date?" }],
      escalationLeases: [{ subjectId: "E1" }],
    });
    const agenda = await svc.compile("p1");
    expect(agenda.items.some((i) => i.kind === "escalation.answered")).toBe(false);
  });
});
