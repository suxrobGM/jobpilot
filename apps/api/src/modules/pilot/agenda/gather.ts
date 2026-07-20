import { CAMPAIGN_JOB_ACTIVE_STATUSES, type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import { parseCampaignConfig } from "./campaign-config";
import {
  GATHER_CAP,
  SCORE_PENDING_BATCH,
  SCORE_PENDING_COOLDOWN_MS,
  WARM_INTRO_MIN_SCORE,
} from "./constants";
import type {
  AgendaApprovedJob,
  AgendaDueQuery,
  AgendaFinalizeCampaign,
  AgendaInbox,
  AgendaQuestion,
  AgendaScorePending,
  WarmContact,
} from "./types";

/** Answered questions not yet consumed by any lease, so a claimed answer never re-appears. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaQuestion[]> {
  const answered = await prisma.question.findMany({
    where: { userId, status: "answered" },
    // Newest first: consumed rows stay "answered" forever, so oldest-first would starve new answers.
    orderBy: { answeredAt: "desc" },
    take: GATHER_CAP,
    select: {
      id: true,
      kind: true,
      prompt: true,
      subjectType: true,
      subjectId: true,
      answer: true,
    },
  });
  if (answered.length === 0) return [];
  // Only the answered ids can be consumed, so scope the lease lookup to them.
  const leases = await prisma.pilotLease.findMany({
    where: {
      userId,
      subjectType: "question",
      subjectId: { in: answered.map((e) => e.id) },
      // An expired/abandoned lease hands the answer back; active or completed leases consume it.
      OR: [
        { releasedAt: null },
        { releasedAt: { not: null }, outcome: { notIn: ["expired", "abandoned"] } },
      ],
    },
    take: GATHER_CAP,
    select: { subjectId: true },
  });
  const consumed = new Set(leases.map((l) => l.subjectId));
  return answered
    .filter((e) => !consumed.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      prompt: e.prompt,
      subjectType: e.subjectType,
      subjectId: e.subjectId,
      answer: e.answer,
    }));
}

/** Approved jobs of in-progress campaigns, each carrying its campaign's resumeId. Parked boards excluded. */
export async function gatherApprovedJobs(
  prisma: PrismaClient,
  userId: string,
  parkedBoards: string[] = [],
): Promise<AgendaApprovedJob[]> {
  const rows = await prisma.job.findMany({
    where: { status: "approved", campaign: { userId, status: "in_progress" } },
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      title: true,
      url: true,
      board: true,
      digest: true,
      matchScore: true,
      company: true,
      campaign: { select: { config: true } },
    },
  });
  // A parked board's jobs are excluded here; null-board jobs are never parked (park keys on board name).
  const parked = new Set(parkedBoards);
  // Jobs of the same campaign share one config; parse each campaign's JSON at most once.
  const configByCampaign = new Map<string, CampaignConfig | null>();
  return rows
    .filter((job) => !(job.board && parked.has(job.board)))
    .map((job) => {
      let cfg = configByCampaign.get(job.campaignId);
      if (cfg === undefined) {
        cfg = parseCampaignConfig(job.campaign.config);
        configByCampaign.set(job.campaignId, cfg);
      }
      return {
        campaignId: job.campaignId,
        key: job.key,
        title: job.title,
        url: job.url,
        board: job.board,
        digest: job.digest,
        matchScore: job.matchScore,
        resumeId: cfg?.resumeId,
        company: job.company,
      };
    });
}

/** Newest lease per subject for one kind - one read instead of an N+1 findFirst per subject. */
async function latestLeaseBySubject(
  prisma: PrismaClient,
  userId: string,
  kind: string,
  subjectIds: string[],
): Promise<Map<string, { grantedAt: Date; releasedAt: Date | null }>> {
  const leases = await prisma.pilotLease.findMany({
    where: { userId, kind, subjectId: { in: subjectIds } },
    orderBy: { grantedAt: "desc" },
    take: GATHER_CAP,
    select: { subjectId: true, grantedAt: true, releasedAt: true },
  });
  const latest = new Map<string, { grantedAt: Date; releasedAt: Date | null }>();
  for (const l of leases) {
    const prev = latest.get(l.subjectId);
    if (!prev || l.grantedAt > prev.grantedAt) {
      latest.set(l.subjectId, { grantedAt: l.grantedAt, releasedAt: l.releasedAt });
    }
  }
  return latest;
}

/**
 * In-progress auto-apply campaigns carrying discovered-but-unscored pending rows (`matchScore: null`) -
 * mid-batch abandonment or thin listings. Each carries ≤{@link SCORE_PENDING_BATCH} sampled entries plus
 * the total unscored count; parked-board campaigns are skipped (park keys on the campaign's config board).
 *
 * Rate-limited per campaign off lease history, like {@link dueSavedSearches}: a row nothing can score
 * (dead URL, login wall) keeps `matchScore: null` forever, and scorePending outranks discovery - without
 * a cooldown that one row would re-win every cycle and starve discovery permanently.
 */
export async function gatherScorePendingCampaigns(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
  parkedBoards: string[] = [],
): Promise<AgendaScorePending[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      source: "auto-apply",
      jobs: { some: { status: "pending", matchScore: null } },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      query: true,
      config: true,
      jobs: {
        where: { status: "pending", matchScore: null },
        orderBy: { createdAt: "asc" },
        take: SCORE_PENDING_BATCH,
        select: { key: true, url: true, title: true },
      },
    },
  });
  if (campaigns.length === 0) return [];

  // One grouped count for every candidate's total unscored backlog, avoiding an N+1 per campaign.
  const counts = await prisma.job.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: campaigns.map((c) => c.campaignId) },
      status: "pending",
      matchScore: null,
    },
    _count: { _all: true },
  });
  const countByCampaign = new Map(counts.map((r) => [r.campaignId, r._count._all]));
  const latest = await latestLeaseBySubject(
    prisma,
    userId,
    "campaign.scorePending",
    campaigns.map((c) => c.campaignId),
  );

  const parked = new Set(parkedBoards);
  const out: AgendaScorePending[] = [];
  for (const c of campaigns) {
    const config = parseCampaignConfig(c.config);
    const board = config?.board ?? null;
    // A campaign targeting a parked board is suppressed until the user un-parks it.
    if (board && parked.has(board)) continue;
    // An open lease means a batch is still running; a recent one means we just scored what we could.
    const last = latest.get(c.campaignId);
    if (
      last &&
      (last.releasedAt == null ||
        now.getTime() - last.releasedAt.getTime() < SCORE_PENDING_COOLDOWN_MS)
    ) {
      continue;
    }
    out.push({
      campaignId: c.campaignId,
      query: c.query,
      board,
      resumeId: config?.resumeId,
      minScore: config?.minScore ?? fallbackMinScore,
      pendingCount: countByCampaign.get(c.campaignId) ?? c.jobs.length,
      entries: c.jobs,
    });
  }
  return out;
}

/** In-progress campaigns with no active jobs left - ready to finalize. */
export function gatherFinalizeCampaigns(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaFinalizeCampaign[]> {
  return prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
    },
    select: { campaignId: true, query: true },
  });
}

/** Oldest-first ids (≤10) plus total count of unclassified synced mail - the scan-inbox predicate. */
export async function gatherInbox(prisma: PrismaClient, userId: string): Promise<AgendaInbox> {
  const where = { account: { userId }, classification: null, reviewStatus: "pending" } as const;
  const [rows, count] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: 10,
      select: { id: true },
    }),
    prisma.emailMessage.count({ where }),
  ]);
  return { messageIds: rows.map((r) => r.id), count };
}

/** Attach same-company contacts (with an email) to jobs scoring at/above the warm-intro threshold. */
export async function attachWarmContacts(
  prisma: PrismaClient,
  userId: string,
  approvedJobs: AgendaApprovedJob[],
): Promise<void> {
  const hot = approvedJobs.filter((j) => (j.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE && j.company);
  if (hot.length === 0) return;
  const contacts = await prisma.contact.findMany({
    where: { userId, email: { not: null }, company: { not: null } },
    orderBy: { createdAt: "desc" },
    take: GATHER_CAP,
    select: { id: true, name: true, title: true, email: true, company: true },
  });
  if (contacts.length === 0) return;
  const normalized = contacts.map((c) => ({ c, norm: normalizeCompanyName(c.company ?? "") }));
  for (const job of hot) {
    const target = normalizeCompanyName(job.company ?? "");
    if (!target) continue;
    const matches: WarmContact[] = normalized
      .filter(({ norm }) => norm.length > 0 && (norm.includes(target) || target.includes(norm)))
      .map(({ c }) => ({ id: c.id, name: c.name, title: c.title, email: c.email }));
    if (matches.length > 0) job.warmContacts = matches;
  }
}

/** Saved searches whose cadence has elapsed since their last released discovery lease. */
export async function dueSavedSearches(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  now: Date,
): Promise<AgendaDueQuery[]> {
  if (config.savedSearches.length === 0) return [];
  const latest = await latestLeaseBySubject(
    prisma,
    userId,
    "search.discover",
    config.savedSearches.map((q) => q.query),
  );

  const parked = new Set(config.parkedBoards);
  const due: AgendaDueQuery[] = [];
  for (const sq of config.savedSearches) {
    // A saved search targeting a parked board is suppressed until the user un-parks it.
    if (sq.board && parked.has(sq.board)) continue;
    const last = latest.get(sq.query);
    const cadenceMs = sq.cadenceHours * HOUR_MS;
    // Due when never run, or the last run released longer ago than the cadence. An active
    // (unreleased) discovery lease means it is in progress, so it is not due.
    const isDue =
      !last || (last.releasedAt != null && now.getTime() - last.releasedAt.getTime() >= cadenceMs);
    if (isDue) due.push({ query: sq.query, board: sq.board, resumeId: sq.resumeId });
  }
  return due;
}
