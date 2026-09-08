import { makePush, type SentPush } from "@/common/push/push.fake";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import type { PilotJournalService } from "../journal.service";
import { AgendaService } from "./service";

type Row = Record<string, unknown>;

/** A prior claim of one kind, as the cooldown and crash dampers read it back. */
type ClaimRow = {
  subjectId: string;
  grantedAt: Date;
  releasedAt: Date | null;
  outcome?: string | null;
};

export interface Recorder {
  promoteScoredJobs: unknown[][];
  campaignUpdates: { where: Row; data: Row }[];
  /** Every campaign.findMany where-clause, so a gather's predicate itself can be asserted on. */
  campaignQueries: Row[];
  journals: Row[];
  pushes: SentPush[];
  inboxSyncs: { userId: string; staleMs: number }[];
}

export interface Over {
  instructionsConfig?: unknown;
  instructionsGoals?: string;
  pilotSearches?: Row[];
  answered?: Row[];
  questionClaims?: { subjectId: string }[];
  approvedJobs?: Row[];
  job?: Row | null;
  activeClaim?: Row | null;
  activeClaims?: number;
  appliedToday?: number;

  // Warm-intro pool: recently-applied high scorers plus that pool's claim damper.
  recentAppliedJobs?: Row[];
  warmIntroClaims?: ClaimRow[];

  // Discovery: due searches, their prior claims (the in-flight and crash damper), reusable campaigns.
  searchClaims?: ClaimRow[];
  dueSearchCampaigns?: { campaignId: string; pilotSearchId: string }[];

  // Score-pending: in-progress auto-apply campaigns with unscored rows, plus their cooldown claims.
  scorePendingCampaigns?: Row[];
  scorePendingClaims?: ClaimRow[];
  /** Scored-but-pending rows swept by promoteScoredPendingJobs (job.findMany with a matchScore filter). */
  scoredPendingJobs?: Row[];

  // Paused-campaign review: paused auto-apply campaigns plus their questions and claim dampers.
  pausedCampaigns?: Row[];
  campaignQuestions?: { subjectId: string; status: string; answeredAt: Date | null }[];
  pausedReviewClaims?: ClaimRow[];

  /** Open job.apply claims protecting in-flight applies from the stale-`applying` sweep. */
  openApplyClaims?: Row[];
  finalizeCampaigns?: Row[];

  approvedNetworking?: Row[];
  contacts?: Row[];
  approvedPromotions?: Row[];
  platformPosts?: Row[];

  interviewReplyApps?: Row[];
  interviewPrepApps?: Row[];
  interviewQuestions?: { subjectId: string }[];

  existingDigests?: number;
  digestApps?: number;
  jobsFailed?: number;
  jobsSkipped?: number;
  networkingSent?: number;
  networkingReplies?: number;
  promotionsPosted?: number;

  queuedCampaigns?: Row[];
  queueDrainClaims?: ClaimRow[];
  boardHealthJobs?: Row[];
  upworkAccount?: { lastSyncedAt: Date | null } | null;
  upworkProfiles?: number;
  upworkUnread?: number;
  upworkSyncClaim?: { grantedAt: Date; releasedAt: Date | null; outcome?: string | null } | null;
  quietCampaigns?: Row[];
  quietJobCounts?: Row[];
  actionMarkers?: { subjectId: string | null; detail: unknown }[];
  skipReasonRows?: { campaignId: string; skipReason: string | null; _count: { _all: number } }[];
  bootstrapClaim?: { id: string } | null;
}

function fakePilotState(over: Over) {
  // Networking is off by default in prod; these compile tests assert networking behavior.
  const config = over.instructionsConfig ?? { networking: { email: "review", linkedIn: "draft" } };
  return {
    upsert: async () => ({ instructionsConfig: config }),
    findUnique: async () => ({
      instructionsConfig: config,
      instructionsGoals: over.instructionsGoals ?? "",
      running: true,
    }),
    update: async () => ({}),
  };
}

/** A merged claim row, so toPilotClaim can map heartbeat and release results. */
const claimRow = () => ({
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
});

function fakePilotClaim(over: Over) {
  const byKind: Record<string, ClaimRow[] | undefined> = {
    "campaign.scorePending": over.scorePendingClaims,
    "queue.drain": over.queueDrainClaims,
    "networking.warmIntro": over.warmIntroClaims,
    "campaign.reviewPaused": over.pausedReviewClaims,
    "search.discover": over.searchClaims,
  };
  return {
    // The cooldown gathers read their own claim history by kind; the rest split on subjectType.
    findMany: async (a: { where: { subjectType?: string; kind?: string } }) => {
      if (a.where.kind === "job.apply") return over.openApplyClaims ?? [];
      if (a.where.kind) return byKind[a.where.kind] ?? [];
      if (a.where.subjectType === "question") return over.questionClaims ?? [];
      return [];
    },
    count: async () => over.activeClaims ?? 0,
    // Damper lookups filter on kind; everything else is the per-subject uniqueness guard.
    findFirst: async (a: { where: { kind?: string } }) => {
      if (a.where.kind === "strategy.bootstrap") return over.bootstrapClaim ?? null;
      if (a.where.kind === "upwork.syncInbox") return over.upworkSyncClaim ?? null;
      return over.activeClaim ?? null;
    },
    update: async (a: { data: Row }) => ({ ...claimRow(), ...a.data }),
    updateMany: async () => ({ count: 0 }),
    create: async (a: { data: Row }) => ({ ...claimRow(), ...a.data }),
  };
}

function fakePilotQuestion(over: Over) {
  return {
    count: async () => 0,
    findFirst: async () => null,
    findMany: async (a: { where: { status?: unknown; subjectType?: string } }) => {
      if (a.where.subjectType === "campaign") return over.campaignQuestions ?? [];
      if (a.where.subjectType === "email") return over.interviewQuestions ?? [];
      if (a.where.status === "answered") return over.answered ?? [];
      return [];
    },
    update: async () => ({}),
    updateMany: async () => ({ count: 0 }),
  };
}

function fakeJob(over: Over) {
  return {
    // status "applied" = warm-intro pool; matchScore filter = promote sweep; status `in` =
    // board-health scan; everything else is the approved-job gather.
    findMany: async (a: { where: { status?: unknown; matchScore?: unknown } }) => {
      if (a.where.status === "applied") return over.recentAppliedJobs ?? [];
      if ("matchScore" in a.where) return over.scoredPendingJobs ?? [];
      if (a.where.status && typeof a.where.status === "object") return over.boardHealthJobs ?? [];
      return over.approvedJobs ?? [];
    },
    findFirst: async () => over.job ?? null,
    findUniqueOrThrow: async () => over.job ?? approvedJob(),
    update: async () => ({}),
    updateMany: async () => ({ count: 1 }),
    groupBy: async (a: { by: string[] }) => {
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
    count: async (a: { where: Row }) => {
      if (over.digestApps != null && a.where.appliedAt != null) return over.digestApps;
      return over.appliedToday ?? 0;
    },
    // The prep gather filters by an `events` none-clause; the reply gather does not, so split there.
    findMany: async (a: { where: Row }) => {
      if (a.where.status !== "interviewing") return [];
      return "events" in a.where ? (over.interviewPrepApps ?? []) : (over.interviewReplyApps ?? []);
    },
  };
}

function fakeCampaign(over: Over, rec: Recorder) {
  return {
    // Each gather is keyed on a field only it sets; finalize also filters `jobs`, so its `OR`
    // branch precedes score-pending's.
    findMany: async (a: { where: { status?: string; source?: string } }) => {
      rec.campaignQueries.push(a.where);
      if (a.where.status === "paused") return over.pausedCampaigns ?? [];
      if ("pilotSearchId" in a.where) return over.dueSearchCampaigns ?? [];
      if ("OR" in a.where) return over.finalizeCampaigns ?? [];
      // Only the queue-drain gather pins a single source; score-pending is the other `jobs` filter.
      if (a.where.source === "apply") return over.queuedCampaigns ?? [];
      if ("jobs" in a.where) return over.scorePendingCampaigns ?? [];
      return over.quietCampaigns ?? [];
    },
    findFirst: async () => null,
    update: async () => ({}),
    // The finalize sweep's guarded completion write.
    updateMany: async (a: { where: Row; data: Row }) => {
      rec.campaignUpdates.push(a);
      return { count: 1 };
    },
  };
}

/** A fake Prisma covering every query the agenda pipeline (expiry, gather, claim, digest) issues. */
export function makeAgendaDb(over: Over = {}) {
  const rec: Recorder = {
    promoteScoredJobs: [],
    campaignUpdates: [],
    campaignQueries: [],
    journals: [],
    pushes: [],
    inboxSyncs: [],
  };

  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    pilotState: fakePilotState(over),
    pilotSearch: {
      findMany: async () => over.pilotSearches ?? [],
      count: async () => (over.pilotSearches ?? []).length,
    },
    pilotClaim: fakePilotClaim(over),
    pilotQuestion: fakePilotQuestion(over),
    job: fakeJob(over),
    application: fakeApplication(over),
    campaign: fakeCampaign(over, rec),
    upworkAccount: { findUnique: async () => over.upworkAccount ?? null },
    upworkProfile: { count: async () => over.upworkProfiles ?? 0 },
    upworkInboxItem: { count: async () => over.upworkUnread ?? 0 },
    networkingMessage: {
      findMany: async (a: { where: Row }) =>
        a.where.status === "approved" ? (over.approvedNetworking ?? []) : [],
      groupBy: async () => [],
      count: async (a: { where: Row }) =>
        "repliedAt" in a.where ? (over.networkingReplies ?? 0) : (over.networkingSent ?? 0),
      findFirst: async () => null,
    },
    promotionPost: {
      findMany: async (a: { where: { status?: unknown } }) =>
        a.where.status === "approved"
          ? (over.approvedPromotions ?? [])
          : (over.platformPosts ?? []),
      count: async () => over.promotionsPosted ?? 0,
      findFirst: async () => null,
    },
    emailMessage: { findMany: async () => [], count: async () => 0 },
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

export function makeCampaignJobs(rec: Recorder): CampaignJobService {
  return {
    promoteScoredJobs: async (...a: unknown[]) => {
      rec.promoteScoredJobs.push(a);
    },
  } as unknown as CampaignJobService;
}

export function makeAgendaDeps(over: Over = {}) {
  const { db, rec } = makeAgendaDb(over);
  const pilot = {
    appendJournal: async (_p: string, body: { entries: Row[] }) => {
      rec.journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
  const emailSync = {
    syncIfStale: async (userId: string, staleMs: number) => {
      rec.inboxSyncs.push({ userId, staleMs });
    },
  } as unknown as EmailSyncService;

  return {
    prisma: db as unknown as PrismaClient,
    campaignJobs: makeCampaignJobs(rec),
    pilot,
    push: makePush(rec.pushes),
    emailSync,
    rec,
  };
}

/** A PilotSearch row for the duePilotSearches gather; `nextRunAt` defaults due (epoch), board null. */
export const pilotSearchRow = (over: Row = {}) => ({
  id: "s1",
  query: "react",
  board: null,
  resumeId: null,
  lastRunAt: null,
  nextRunAt: new Date(0),
  ...over,
});

export const approvedJob = (over: Row = {}) => ({
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

export const serviceWithRec = (over: Over = {}) => {
  const { prisma, campaignJobs, pilot, push, emailSync, rec } = makeAgendaDeps(over);
  return { svc: new AgendaService(prisma, campaignJobs, pilot, push, emailSync), rec };
};

export const service = (over: Over = {}) => serviceWithRec(over).svc;
