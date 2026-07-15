// Shared fake-Prisma scaffolding for the pilot suites. Type-only imports of the real services keep
// this file (and therefore build.test, which stays pure) from loading `@/env` at module time.
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotService } from "../pilot.service";
import type { PushPayload, PushService } from "../push.service";

export interface Recorder {
  patchJob: unknown[][];
  recordResult: unknown[][];
  claimJobForApply: unknown[][];
  leaseCreates: Record<string, unknown>[];
  leaseUpdates: { data: Record<string, unknown> }[];
  escalationUpdates: { data: Record<string, unknown> }[];
  journals: Record<string, unknown>[];
  pushes: { profileId: string; payload: PushPayload }[];
}

export interface Over {
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
  activeLease?: Record<string, unknown> | null;
  inboxIds?: { id: string }[];
  inboxCount?: number;
  approvedOutreach?: Record<string, unknown>[];
  followupCandidates?: Record<string, unknown>[];
  followupLatest?: { contactId: string; _max: { createdAt: Date } }[];
  contacts?: Record<string, unknown>[];
  approvedPromotions?: Record<string, unknown>[];
  venuePosts?: Record<string, unknown>[];
  promoFindFirst?: Record<string, unknown> | null;
  messageFindFirst?: Record<string, unknown> | null;
  // Interview wiring:
  interviewReplyApps?: Record<string, unknown>[];
  interviewPrepApps?: Record<string, unknown>[];
  interviewEscalations?: { subjectId: string }[];
  // Digest wiring:
  existingDigests?: number;
  digestApps?: number;
  jobsFailed?: number;
  jobsSkipped?: number;
  outreachSent?: number;
  outreachReplies?: number;
  promotionsPosted?: number;
  // Proactive wiring:
  pendingQueue?: { id: string; url: string }[];
  pendingQueueCount?: number;
  boardHealthJobs?: Record<string, unknown>[];
  quietCampaigns?: Record<string, unknown>[];
  actionMarkers?: { subjectId: string | null; detail: string }[];
  skipReasonRows?: { skipReason: string | null; _count: { _all: number } }[];
}

/** A fake Prisma covering every query the agenda pipeline (expiry, gather, lease, digest) issues. */
export function makeAgendaDb(over: Over = {}) {
  const rec: Recorder = {
    patchJob: [],
    recordResult: [],
    claimJobForApply: [],
    leaseCreates: [],
    leaseUpdates: [],
    escalationUpdates: [],
    journals: [],
    pushes: [],
  };

  const db = {
    pilotState: {
      upsert: async () => ({ mandateConfig: over.mandateConfig ?? "{}" }),
      findUnique: async () => ({ mandateConfig: over.mandateConfig ?? "{}" }),
    },
    pilotLease: {
      findMany: async (args: { where: { subjectType?: string } }) =>
        args.where.subjectType === "escalation"
          ? (over.escalationLeases ?? [])
          : (over.expiredLeases ?? []),
      count: async () => over.activeLeases ?? 0,
      // First arg = the per-subject uniqueness guard; escalation-consumed lookups reuse findMany.
      findFirst: async () => over.activeLease ?? null,
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
      findMany: async (args: { where: { status?: string; subjectType?: string } }) =>
        args.where.subjectType === "email"
          ? (over.interviewEscalations ?? [])
          : args.where.status === "answered"
            ? (over.answered ?? [])
            : (over.expiredEscalations ?? []),
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
      // Board-health scans applied/failed rows (status is an `in` filter); everything else is the approved gather.
      findMany: async (a: { where: { status?: unknown } }) =>
        a.where.status && typeof a.where.status === "object"
          ? (over.boardHealthJobs ?? [])
          : (over.approvedJobs ?? []),
      findFirst: async () => over.job ?? null,
      update: async () => ({}),
      groupBy: async () => over.skipReasonRows ?? [],
      count: async (a: { where: { status?: string } }) =>
        a.where.status === "failed"
          ? (over.jobsFailed ?? 0)
          : a.where.status === "skipped"
            ? (over.jobsSkipped ?? 0)
            : 0,
    },
    application: {
      count: async (a: { where: Record<string, unknown> }) =>
        over.digestApps != null && "appliedAt" in a.where && a.where.appliedAt != null
          ? over.digestApps
          : (over.appliedToday ?? 0),
      // The prep gather filters by an `events` none-clause; the reply gather does not - split on that.
      findMany: async (a: { where: Record<string, unknown> }) =>
        a.where.status !== "interviewing"
          ? []
          : "events" in a.where
            ? (over.interviewPrepApps ?? [])
            : (over.interviewReplyApps ?? []),
    },
    campaign: {
      // Finalize gather filters on a `jobs` none-clause; the quiet-candidate gather does not - split on that.
      findMany: async (a: { where: Record<string, unknown> }) =>
        "jobs" in a.where ? (over.finalizeCampaigns ?? []) : (over.quietCampaigns ?? []),
      update: async () => ({}),
    },
    queueEntry: {
      findMany: async () => over.pendingQueue ?? [],
      count: async () => over.pendingQueueCount ?? 0,
    },
    emailMessage: {
      findMany: async () => over.inboxIds ?? [],
      count: async () => over.inboxCount ?? 0,
    },
    outreachMessage: {
      findMany: async (a: { where: Record<string, unknown> }) =>
        a.where.status === "approved"
          ? (over.approvedOutreach ?? [])
          : (over.followupCandidates ?? []),
      groupBy: async () => over.followupLatest ?? [],
      count: async (a: { where: Record<string, unknown> }) =>
        "repliedAt" in a.where ? (over.outreachReplies ?? 0) : (over.outreachSent ?? 0),
      findFirst: async () => over.messageFindFirst ?? null,
    },
    contact: { findMany: async () => over.contacts ?? [] },
    promotionPost: {
      findMany: async (a: { where: { status?: unknown } }) =>
        a.where.status === "approved" ? (over.approvedPromotions ?? []) : (over.venuePosts ?? []),
      count: async () => over.promotionsPosted ?? 0,
      findFirst: async () => over.promoFindFirst ?? null,
    },
    pilotJournalEntry: {
      // Default 1 so the digest guard treats it as already written and stays quiet in unrelated tests.
      count: async () => over.existingDigests ?? 1,
      // Action-journal markers the quiet-candidate gather dedupes against.
      findMany: async () => over.actionMarkers ?? [],
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };

  return { db, rec };
}

/** Fake CampaignJobService that records calls; a `claimCount` of 0 makes the claim lose its race. */
export function makeCampaignJobs(rec: Recorder, over: Over = {}): CampaignJobService {
  return {
    patchJob: async (...a: unknown[]) => {
      rec.patchJob.push(a);
    },
    recordJobResult: async (...a: unknown[]) => {
      rec.recordResult.push(a);
    },
    claimJobForApply: async (...a: unknown[]) => {
      rec.claimJobForApply.push(a);
      if ((over.claimCount ?? 1) === 0) {
        throw new Error("Job is no longer approved.");
      }
    },
  } as unknown as CampaignJobService;
}

/** Fake PilotService recording journal appends (the digest write path). */
export function makePilot(rec: Pick<Recorder, "journals">): PilotService {
  return {
    appendJournal: async (_p: string, body: { entries: Record<string, unknown>[] }) => {
      rec.journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotService;
}

/** Fake PushService recording sendToProfile calls without any web-push/env dependency. */
export function makePush(rec: Pick<Recorder, "pushes">): PushService {
  return {
    sendToProfile: async (profileId: string, payload: PushPayload) => {
      rec.pushes.push({ profileId, payload });
    },
  } as unknown as PushService;
}

/** The full set of fakes an agenda test needs: prisma plus the three injected collaborators. */
export function makeAgendaDeps(over: Over = {}) {
  const { db, rec } = makeAgendaDb(over);
  return {
    prisma: db as unknown as PrismaClient,
    campaignJobs: makeCampaignJobs(rec, over),
    pilot: makePilot(rec),
    push: makePush(rec),
    rec,
  };
}

export const approvedJob = (over: Record<string, unknown> = {}) => ({
  campaignId: "c1",
  key: "jobkey",
  title: "Engineer",
  url: "https://x/1",
  board: null,
  digest: null,
  company: "Acme",
  matchScore: 80,
  campaign: { config: "{}" },
  ...over,
});
