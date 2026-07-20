// Shared fake-Prisma scaffolding for the pilot suites. Type-only imports of the real services keep
// this file (and therefore build.test, which stays pure) from loading `@/env` at module time.

import type { PushPayload, PushService } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignService } from "@/modules/campaign/campaign.service";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotJournalService } from "../journal.service";

export interface Recorder {
  patchJob: unknown[][];
  recordResult: unknown[][];
  claimJobForApply: unknown[][];
  leaseCreates: Record<string, unknown>[];
  leaseUpdates: { data: Record<string, unknown> }[];
  questionUpdates: { data: Record<string, unknown> }[];
  journals: Record<string, unknown>[];
  pushes: { userId: string; payload: PushPayload }[];
}

export interface Over {
  instructionsConfig?: string;
  instructionsGoals?: string;
  expiredLeases?: Record<string, unknown>[];
  questionLeases?: { subjectId: string }[];
  expiredQuestions?: Record<string, unknown>[];
  answered?: Record<string, unknown>[];
  approvedJobs?: Record<string, unknown>[];
  appliedToday?: number;
  activeLeases?: number;
  finalizeCampaigns?: Record<string, unknown>[];
  // Score-pending gather (in_progress auto-apply campaigns with unscored pending rows) + its count groupBy.
  scorePendingCampaigns?: Record<string, unknown>[];
  scorePendingCounts?: { campaignId: string; _count: { _all: number } }[];
  // Prior campaign.scorePending leases, gating the per-campaign cooldown.
  scorePendingLeases?: { subjectId: string; grantedAt: Date; releasedAt: Date | null }[];
  // Pilot self-heal (compile) reads `pilotState.enabled` and flips these interrupted campaigns back.
  pilotEnabled?: boolean;
  interruptedCampaigns?: Record<string, unknown>[];
  // verifyGrant's leasability check for campaign.scorePending (null = 409, no unscored rows left).
  campaignFindFirst?: Record<string, unknown> | null;
  // Scored-but-pending rows swept by promoteScoredPendingJobs (job.findMany with a matchScore filter).
  scoredPendingJobs?: Record<string, unknown>[];
  job?: Record<string, unknown> | null;
  claimCount?: number;
  activeLease?: Record<string, unknown> | null;
  inboxIds?: { id: string }[];
  inboxCount?: number;
  approvedNetworking?: Record<string, unknown>[];
  followupCandidates?: Record<string, unknown>[];
  followupLatest?: { contactId: string; _max: { createdAt: Date } }[];
  contacts?: Record<string, unknown>[];
  approvedPromotions?: Record<string, unknown>[];
  platformPosts?: Record<string, unknown>[];
  promoFindFirst?: Record<string, unknown> | null;
  messageFindFirst?: Record<string, unknown> | null;
  // Interview wiring:
  interviewReplyApps?: Record<string, unknown>[];
  interviewPrepApps?: Record<string, unknown>[];
  interviewQuestions?: { subjectId: string }[];
  // Digest wiring:
  existingDigests?: number;
  digestApps?: number;
  jobsFailed?: number;
  jobsSkipped?: number;
  networkingSent?: number;
  networkingReplies?: number;
  promotionsPosted?: number;
  // Proactive wiring:
  pendingQueue?: { id: string; url: string }[];
  pendingQueueCount?: number;
  boardHealthJobs?: Record<string, unknown>[];
  quietCampaigns?: Record<string, unknown>[];
  actionMarkers?: { subjectId: string | null; detail: string }[];
  skipReasonRows?: { campaignId: string; skipReason: string | null; _count: { _all: number } }[];
  // Bootstrap wiring:
  bootstrapLease?: { id: string } | null;
  pilotBootstrapQuestion?: { id: string } | null;
}

/** A fake Prisma covering every query the agenda pipeline (expiry, gather, lease, digest) issues. */
export function makeAgendaDb(over: Over = {}) {
  const rec: Recorder = {
    patchJob: [],
    recordResult: [],
    claimJobForApply: [],
    leaseCreates: [],
    leaseUpdates: [],
    questionUpdates: [],
    journals: [],
    pushes: [],
  };

  // Networking is opt-in in prod; these compile tests assert networking behavior, so default it on.
  const defaultConfig = '{"networkingEnabled":true}';
  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    pilotState: {
      upsert: async () => ({ instructionsConfig: over.instructionsConfig ?? defaultConfig }),
      findUnique: async () => ({
        instructionsConfig: over.instructionsConfig ?? defaultConfig,
        instructionsGoals: over.instructionsGoals ?? "",
        enabled: over.pilotEnabled ?? false,
      }),
    },
    pilotLease: {
      // The score-pending cooldown reads its own lease history by kind; the rest split on subjectType.
      findMany: async (args: { where: { subjectType?: string; kind?: string } }) => {
        if (args.where.kind === "campaign.scorePending") return over.scorePendingLeases ?? [];
        return args.where.subjectType === "question"
          ? (over.questionLeases ?? [])
          : (over.expiredLeases ?? []);
      },
      count: async () => over.activeLeases ?? 0,
      // Bootstrap-damper lookups filter on kind; everything else is the per-subject uniqueness guard.
      findFirst: async (a: { where: { kind?: string } }) =>
        a.where.kind === "strategy.bootstrap"
          ? (over.bootstrapLease ?? null)
          : (over.activeLease ?? null),
      update: async (a: { data: Record<string, unknown> }) => {
        rec.leaseUpdates.push(a);
        // Full merged row so toPilotLease can map heartbeat/release results.
        return {
          id: "lease-1",
          kind: "job.apply",
          subjectType: "job",
          subjectId: "s1",
          payload: "{}",
          grantedAt: new Date(),
          expiresAt: new Date(),
          heartbeatAt: null,
          releasedAt: null,
          outcome: null,
          ...a.data,
        };
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
    question: {
      count: async () => 0,
      findFirst: async () => over.pilotBootstrapQuestion ?? null,
      findMany: async (args: { where: { status?: string; subjectType?: string } }) =>
        args.where.subjectType === "email"
          ? (over.interviewQuestions ?? [])
          : args.where.status === "answered"
            ? (over.answered ?? [])
            : (over.expiredQuestions ?? []),
      update: async (a: { data: Record<string, unknown> }) => {
        rec.questionUpdates.push(a);
        return {};
      },
      updateMany: async (a: { data: Record<string, unknown> }) => {
        rec.questionUpdates.push(a);
        return { count: (over.expiredQuestions ?? []).length };
      },
    },
    job: {
      // A matchScore filter is the promote sweep (scored-pending rows); a status `in` filter is the
      // board-health scan; everything else is the approved-job gather.
      findMany: async (a: { where: { status?: unknown; matchScore?: unknown } }) => {
        if ("matchScore" in a.where) return over.scoredPendingJobs ?? [];
        if (a.where.status && typeof a.where.status === "object") return over.boardHealthJobs ?? [];
        return over.approvedJobs ?? [];
      },
      findFirst: async () => over.job ?? null,
      update: async () => ({}),
      // groupBy by ["campaignId"] alone is the score-pending count; ["campaignId","skipReason"] is skip reasons.
      groupBy: async (a: { by: string[] }) => {
        if (a.by.length === 1) return over.scorePendingCounts ?? [];
        return over.skipReasonRows ?? [];
      },
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
      // Split the campaign gathers by their distinguishing where-clause: interrupted (self-heal),
      // source auto-apply (score-pending), a `jobs` clause (finalize), else the quiet-candidate gather.
      findMany: async (a: { where: { status?: string; source?: string; jobs?: unknown } }) => {
        if (a.where.status === "interrupted") return over.interruptedCampaigns ?? [];
        if (a.where.source === "auto-apply") return over.scorePendingCampaigns ?? [];
        if ("jobs" in a.where) return over.finalizeCampaigns ?? [];
        return over.quietCampaigns ?? [];
      },
      findFirst: async () => over.campaignFindFirst ?? null,
      update: async () => ({}),
      updateMany: async () => ({ count: (over.interruptedCampaigns ?? []).length }),
    },
    queueEntry: {
      findMany: async () => over.pendingQueue ?? [],
      count: async () => over.pendingQueueCount ?? 0,
    },
    emailMessage: {
      findMany: async () => over.inboxIds ?? [],
      count: async () => over.inboxCount ?? 0,
    },
    networkingMessage: {
      findMany: async (a: { where: Record<string, unknown> }) =>
        a.where.status === "approved"
          ? (over.approvedNetworking ?? [])
          : (over.followupCandidates ?? []),
      groupBy: async () => over.followupLatest ?? [],
      count: async (a: { where: Record<string, unknown> }) =>
        "repliedAt" in a.where ? (over.networkingReplies ?? 0) : (over.networkingSent ?? 0),
      findFirst: async () => over.messageFindFirst ?? null,
    },
    contact: { findMany: async () => over.contacts ?? [] },
    promotionPost: {
      findMany: async (a: { where: { status?: unknown } }) =>
        a.where.status === "approved"
          ? (over.approvedPromotions ?? [])
          : (over.platformPosts ?? []),
      count: async () => over.promotionsPosted ?? 0,
      findFirst: async () => over.promoFindFirst ?? null,
    },
    pilotJournalEntry: {
      // Default 1 keeps the digest quiet in unrelated tests; adding this run's digest writes lets
      // the guard observe a concurrent writer's insert (the advisory-lock race test).
      count: async () =>
        (over.existingDigests ?? 1) + rec.journals.filter((j) => j.kind === "digest").length,
      // Action-journal markers the quiet-candidate gather dedupes against.
      findMany: async () => over.actionMarkers ?? [],
    },
    $queryRaw: async () => [],
    // Serialized like the advisory xact lock would, so concurrent digest writes queue up.
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => {
      const run = txChain.then(() => cb(db));
      txChain = run.catch(() => undefined);
      return run;
    },
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

/** Fake CampaignService: the agenda compile only calls `selfHealForPilot`, a no-op in most tests. */
export function makeCampaignService(over: Over = {}): CampaignService {
  return {
    selfHealForPilot: async () =>
      over.pilotEnabled ? (over.interruptedCampaigns ?? []).length : 0,
  } as unknown as CampaignService;
}

/** Fake PilotJournalService recording journal appends (the digest write path). */
export function makePilot(rec: Pick<Recorder, "journals">): PilotJournalService {
  return {
    appendJournal: async (_p: string, body: { entries: Record<string, unknown>[] }) => {
      rec.journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
}

/** Fake PushService recording sendToUser calls without any web-push/env dependency. */
export function makePush(rec: Pick<Recorder, "pushes">): PushService {
  return {
    sendToUser: async (userId: string, payload: PushPayload) => {
      rec.pushes.push({ userId, payload });
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
    campaigns: makeCampaignService(over),
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
