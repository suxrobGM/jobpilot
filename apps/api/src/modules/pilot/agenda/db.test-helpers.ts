// Shared fake-Prisma scaffolding for the pilot suites. Type-only imports of the real services keep
// this file (and therefore build.test, which stays pure) from loading `@/env` at module time.

import type { PushPayload, PushService } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotJournalService } from "../journal.service";

export interface Recorder {
  patchJob: unknown[][];
  recordResult: unknown[][];
  promoteScoredJobs: unknown[][];
  claimJobForApply: unknown[][];
  claimCreates: Record<string, unknown>[];
  claimUpdates: { data: Record<string, unknown> }[];
  questionUpdates: { data: Record<string, unknown> }[];
  journals: Record<string, unknown>[];
  pushes: { userId: string; payload: PushPayload }[];
}

export interface Over {
  instructionsConfig?: unknown;
  instructionsGoals?: string;
  expiredClaims?: Record<string, unknown>[];
  questionClaims?: { subjectId: string }[];
  expiredQuestions?: Record<string, unknown>[];
  answered?: Record<string, unknown>[];
  approvedJobs?: Record<string, unknown>[];
  appliedToday?: number;
  activeClaims?: number;
  finalizeCampaigns?: Record<string, unknown>[];
  // Score-pending gather (in_progress auto-apply campaigns with unscored pending rows) + its count groupBy.
  scorePendingCampaigns?: Record<string, unknown>[];
  scorePendingCounts?: { campaignId: string; _count: { _all: number } }[];
  // Prior campaign.scorePending claims, gating the per-campaign cooldown. `outcome` drives the crash-retry cap.
  scorePendingClaims?: {
    subjectId: string;
    grantedAt: Date;
    releasedAt: Date | null;
    outcome?: string | null;
  }[];
  // Paused-campaign review gather: paused auto-apply campaigns + their questions/claim dampers.
  pausedCampaigns?: Record<string, unknown>[];
  campaignQuestions?: { subjectId: string; status: string; answeredAt: Date | null }[];
  pausedReviewClaims?: {
    subjectId: string;
    grantedAt: Date;
    releasedAt: Date | null;
    outcome?: string | null;
  }[];
  // Open job.apply claims protecting in-flight applies from the stale-`applying` sweep.
  openApplyClaims?: Record<string, unknown>[];
  pilotEnabled?: boolean;
  // verifyGrant's claimability check for campaign kinds (null = 409, the row left the claimable state).
  campaignFindFirst?: Record<string, unknown> | null;
  // Scored-but-pending rows swept by promoteScoredPendingJobs (job.findMany with a matchScore filter).
  scoredPendingJobs?: Record<string, unknown>[];
  job?: Record<string, unknown> | null;
  claimCount?: number;
  activeClaim?: Record<string, unknown> | null;
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
  quietJobCounts?: Record<string, unknown>[];
  actionMarkers?: { subjectId: string | null; detail: unknown }[];
  skipReasonRows?: { campaignId: string; skipReason: string | null; _count: { _all: number } }[];
  // Bootstrap wiring:
  bootstrapClaim?: { id: string } | null;
  pilotBootstrapQuestion?: { id: string } | null;
}

// Per-model fakes, composed by makeAgendaDb. Each covers every query the agenda pipeline
// (expiry, gather, claim, digest) issues against that model.

function fakePilotState(over: Over) {
  // Networking is opt-in in prod; these compile tests assert networking behavior, so default it on.
  const defaultConfig = { networkingEnabled: true };
  return {
    upsert: async () => ({ instructionsConfig: over.instructionsConfig ?? defaultConfig }),
    findUnique: async () => ({
      instructionsConfig: over.instructionsConfig ?? defaultConfig,
      instructionsGoals: over.instructionsGoals ?? "",
      enabled: over.pilotEnabled ?? true,
    }),
    update: async () => ({}),
  };
}

function fakePilotClaim(over: Over, rec: Recorder) {
  return {
    // The cooldown gathers read their own claim history by kind; the rest split on subjectType.
    findMany: async (args: { where: { subjectType?: string; kind?: string } }) => {
      if (args.where.kind === "campaign.scorePending") return over.scorePendingClaims ?? [];
      if (args.where.kind === "campaign.reviewPaused") return over.pausedReviewClaims ?? [];
      if (args.where.kind === "job.apply") return over.openApplyClaims ?? [];
      if (args.where.subjectType === "question") return over.questionClaims ?? [];
      return over.expiredClaims ?? [];
    },
    count: async () => over.activeClaims ?? 0,
    // Bootstrap-damper lookups filter on kind; everything else is the per-subject uniqueness guard.
    findFirst: async (a: { where: { kind?: string } }) =>
      a.where.kind === "strategy.bootstrap"
        ? (over.bootstrapClaim ?? null)
        : (over.activeClaim ?? null),
    update: async (a: { data: Record<string, unknown> }) => {
      rec.claimUpdates.push(a);
      // Full merged row so toPilotClaim can map heartbeat/release results.
      return {
        id: "claim-1",
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
      rec.claimUpdates.push(a);
      return { count: (over.expiredClaims ?? []).length };
    },
    create: async (a: { data: Record<string, unknown> }) => {
      rec.claimCreates.push(a.data);
      return {
        id: "claim-1",
        grantedAt: new Date(),
        heartbeatAt: null,
        releasedAt: null,
        outcome: null,
        ...a.data,
      };
    },
  };
}

function fakePilotQuestion(over: Over, rec: Recorder) {
  return {
    count: async () => 0,
    findFirst: async () => over.pilotBootstrapQuestion ?? null,
    findMany: async (args: { where: { status?: unknown; subjectType?: string } }) => {
      if (args.where.subjectType === "campaign") return over.campaignQuestions ?? [];
      if (args.where.subjectType === "email") return over.interviewQuestions ?? [];
      if (args.where.status === "answered") return over.answered ?? [];
      return over.expiredQuestions ?? [];
    },
    update: async (a: { data: Record<string, unknown> }) => {
      rec.questionUpdates.push(a);
      return {};
    },
    updateMany: async (a: { data: Record<string, unknown> }) => {
      rec.questionUpdates.push(a);
      return { count: (over.expiredQuestions ?? []).length };
    },
  };
}

function fakeJob(over: Over) {
  return {
    // A matchScore filter is the promote sweep (scored-pending rows); a status `in` filter is the
    // board-health scan; everything else is the approved-job gather.
    findMany: async (a: { where: { status?: unknown; matchScore?: unknown } }) => {
      if ("matchScore" in a.where) return over.scoredPendingJobs ?? [];
      if (a.where.status && typeof a.where.status === "object") return over.boardHealthJobs ?? [];
      return over.approvedJobs ?? [];
    },
    findFirst: async () => over.job ?? null,
    update: async () => ({}),
    updateMany: async () => ({ count: over.claimCount ?? 1 }),
    findUniqueOrThrow: async () => over.job ?? approvedJob(),
    // groupBy by ["campaignId"] alone is the score-pending count; ["campaignId","skipReason"] is skip reasons.
    groupBy: async (a: { by: string[] }) => {
      if (a.by.length === 1) return over.scorePendingCounts ?? [];
      if (a.by.includes("skipReason")) return over.skipReasonRows ?? [];
      if (over.quietJobCounts) return over.quietJobCounts;
      if (!over.quietCampaigns?.length) return [];
      return [
        { campaignId: "c1", status: "applied", _count: { _all: 1 } },
        { campaignId: "c1", status: "skipped", _count: { _all: 36 } },
        { campaignId: "c1", status: "failed", _count: { _all: 3 } },
      ];
    },
    count: async (a: { where: { status?: string } }) => {
      if (a.where.status === "failed") return over.jobsFailed ?? 0;
      if (a.where.status === "skipped") return over.jobsSkipped ?? 0;
      return 0;
    },
  };
}

function fakeApplication(over: Over) {
  return {
    count: async (a: { where: Record<string, unknown> }) => {
      if (over.digestApps != null && "appliedAt" in a.where && a.where.appliedAt != null) {
        return over.digestApps;
      }
      return over.appliedToday ?? 0;
    },
    // The prep gather filters by an `events` none-clause; the reply gather does not - split on that.
    findMany: async (a: { where: Record<string, unknown> }) => {
      if (a.where.status !== "interviewing") return [];
      return "events" in a.where ? (over.interviewPrepApps ?? []) : (over.interviewReplyApps ?? []);
    },
  };
}

function fakeCampaign(over: Over) {
  return {
    // Split campaign gathers: status paused (paused review) before source auto-apply
    // (score-pending, which also sets that source), then the `OR` finalization clause,
    // then the quiet-candidate gather.
    findMany: async (a: {
      where: { status?: string; source?: string; jobs?: unknown; OR?: unknown };
    }) => {
      if (a.where.status === "paused") return over.pausedCampaigns ?? [];
      if (a.where.source === "auto_apply") return over.scorePendingCampaigns ?? [];
      if ("OR" in a.where) return over.finalizeCampaigns ?? [];
      return over.quietCampaigns ?? [];
    },
    findFirst: async () => over.campaignFindFirst ?? null,
    update: async () => ({}),
  };
}

function fakeNetworkingMessage(over: Over) {
  return {
    findMany: async (a: { where: Record<string, unknown> }) =>
      a.where.status === "approved"
        ? (over.approvedNetworking ?? [])
        : (over.followupCandidates ?? []),
    groupBy: async () => over.followupLatest ?? [],
    count: async (a: { where: Record<string, unknown> }) =>
      "repliedAt" in a.where ? (over.networkingReplies ?? 0) : (over.networkingSent ?? 0),
    findFirst: async () => over.messageFindFirst ?? null,
  };
}

function fakePromotionPost(over: Over) {
  return {
    findMany: async (a: { where: { status?: unknown } }) =>
      a.where.status === "approved" ? (over.approvedPromotions ?? []) : (over.platformPosts ?? []),
    count: async () => over.promotionsPosted ?? 0,
    findFirst: async () => over.promoFindFirst ?? null,
  };
}

/** A fake Prisma covering every query the agenda pipeline (expiry, gather, claim, digest) issues. */
export function makeAgendaDb(over: Over = {}) {
  const rec: Recorder = {
    patchJob: [],
    recordResult: [],
    promoteScoredJobs: [],
    claimJobForApply: [],
    claimCreates: [],
    claimUpdates: [],
    questionUpdates: [],
    journals: [],
    pushes: [],
  };

  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    pilotState: fakePilotState(over),
    pilotClaim: fakePilotClaim(over, rec),
    pilotQuestion: fakePilotQuestion(over, rec),
    job: fakeJob(over),
    application: fakeApplication(over),
    campaign: fakeCampaign(over),
    networkingMessage: fakeNetworkingMessage(over),
    promotionPost: fakePromotionPost(over),
    queueEntry: {
      findMany: async () => over.pendingQueue ?? [],
      count: async () => over.pendingQueueCount ?? 0,
      updateMany: async () => ({ count: 1 }),
    },
    emailMessage: {
      findMany: async () => over.inboxIds ?? [],
      count: async () => over.inboxCount ?? 0,
    },
    contact: { findMany: async () => over.contacts ?? [] },
    pilotJournalEntry: {
      // Default 1 keeps the digest quiet in unrelated tests; adding this run's digest writes lets
      // the guard observe a concurrent writer's insert (the advisory-lock race test).
      count: async () =>
        (over.existingDigests ?? 1) + rec.journals.filter((j) => j.kind === "digest").length,
      // Action-journal markers the quiet-candidate gather dedupes against.
      findMany: async () => over.actionMarkers ?? [],
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
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
    promoteScoredJobs: async (...a: unknown[]) => {
      rec.promoteScoredJobs.push(a);
    },
    claimJobForApply: async (...a: unknown[]) => {
      rec.claimJobForApply.push(a);
      if ((over.claimCount ?? 1) === 0) {
        throw new Error("Job is no longer approved.");
      }
    },
  } as unknown as CampaignJobService;
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
  campaign: { config: {} },
  ...over,
});
