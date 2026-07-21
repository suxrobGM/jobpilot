import { type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig } from "@/modules/campaign/campaign.config";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import {
  CRASH_RETRY_MS,
  GATHER_CAP,
  SCORE_PENDING_BATCH,
  SCORE_PENDING_COOLDOWN_MS,
  WARM_INTRO_MIN_SCORE,
} from "./constants";
import type { AgendaApprovedJob, AgendaDueQuery, AgendaScorePending, WarmContact } from "./types";

/** Approved jobs of in-progress campaigns, each carrying its campaign's resumeId. Parked boards excluded. */
export async function gatherApprovedJobs(
  prisma: PrismaClient,
  userId: string,
  parkedBoards: string[],
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
  const configByCampaign = new Map<string, CampaignConfig>();

  return rows
    .filter((job) => !(job.board && parked.has(job.board)))
    .map((job) => {
      let cfg = configByCampaign.get(job.campaignId);
      if (!cfg) {
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
        resumeId: cfg.resumeId,
        company: job.company,
      };
    });
}

export interface LatestClaim {
  grantedAt: Date;
  releasedAt: Date | null;
  outcome: string | null;
}

/** Newest claim per subject for one kind - one read instead of an N+1 findFirst per subject. */
export async function latestClaimBySubject(
  prisma: PrismaClient,
  userId: string,
  kind: string,
  subjectIds: string[],
): Promise<Map<string, LatestClaim>> {
  const claims = await prisma.pilotClaim.findMany({
    where: { userId, kind, subjectId: { in: subjectIds } },
    orderBy: { grantedAt: "desc" },
    take: GATHER_CAP,
    select: { subjectId: true, grantedAt: true, releasedAt: true, outcome: true },
  });

  const latest = new Map<string, LatestClaim>();

  for (const c of claims) {
    const prev = latest.get(c.subjectId);
    if (!prev || c.grantedAt > prev.grantedAt) {
      latest.set(c.subjectId, {
        grantedAt: c.grantedAt,
        releasedAt: c.releasedAt,
        outcome: c.outcome,
      });
    }
  }
  return latest;
}

/**
 * An unreleased claim means the work is still running; a recently released one damps a re-run loop.
 * Claims that ended `expired`/`abandoned` are crash recovery, not a deliberate decision, so their
 * cooldown is capped at CRASH_RETRY_MS - crash-recovered work retries within hours, not days.
 */
export function claimDamped(last: LatestClaim | undefined, now: Date, cooldownMs: number): boolean {
  if (!last) return false;
  if (last.releasedAt == null) return true;
  const crashRecovered = last.outcome === "expired" || last.outcome === "abandoned";
  const cap = crashRecovered ? Math.min(cooldownMs, CRASH_RETRY_MS) : cooldownMs;
  return now.getTime() - last.releasedAt.getTime() < cap;
}

/**
 * In-progress auto-apply campaigns carrying discovered-but-unscored pending rows (`matchScore: null`) -
 * mid-batch abandonment or thin listings. Each carries ≤{@link SCORE_PENDING_BATCH} sampled entries plus
 * the total unscored count; parked-board campaigns are skipped (park keys on the campaign's config board).
 *
 * Rate-limited per campaign off claim history, like {@link dueSavedSearches}: a row nothing can score
 * (dead URL, login wall) keeps `matchScore: null` forever, and scorePending outranks discovery - without
 * a cooldown that one row would re-win every cycle and starve discovery permanently.
 */
export async function gatherScorePendingCampaigns(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
  parkedBoards: string[],
): Promise<AgendaScorePending[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      source: "auto_apply",
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
  const latest = await latestClaimBySubject(
    prisma,
    userId,
    "campaign.scorePending",
    campaigns.map((c) => c.campaignId),
  );

  const parked = new Set(parkedBoards);
  const out: AgendaScorePending[] = [];

  for (const c of campaigns) {
    const config = parseCampaignConfig(c.config);
    const board = config.board ?? null;
    // A campaign targeting a parked board is suppressed until the user un-parks it.
    if (board && parked.has(board)) continue;
    if (claimDamped(latest.get(c.campaignId), now, SCORE_PENDING_COOLDOWN_MS)) continue;
    out.push({
      campaignId: c.campaignId,
      query: c.query,
      board,
      resumeId: config.resumeId,
      minScore: config.minScore ?? fallbackMinScore,
      pendingCount: countByCampaign.get(c.campaignId) ?? c.jobs.length,
      entries: c.jobs,
    });
  }
  return out;
}

/** Attach same-company contacts (with an email) to jobs scoring at/above the warm-intro threshold. */
export async function attachWarmContacts(
  prisma: PrismaClient,
  userId: string,
  approvedJobs: AgendaApprovedJob[],
): Promise<void> {
  const hot = approvedJobs.filter((j) => (j.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE && j.company);
  if (hot.length === 0) {
    return;
  }

  const contacts = await prisma.contact.findMany({
    where: { userId, email: { not: null }, company: { not: null } },
    orderBy: { createdAt: "desc" },
    take: GATHER_CAP,
    select: { id: true, name: true, title: true, email: true, company: true },
  });

  if (contacts.length === 0) {
    return;
  }
  const normalized = contacts.map((c) => ({ c, norm: normalizeCompanyName(c.company ?? "") }));

  for (const job of hot) {
    const target = normalizeCompanyName(job.company ?? "");
    if (!target) {
      continue;
    }
    const matches: WarmContact[] = normalized
      .filter(({ norm }) => norm.length > 0 && (norm.includes(target) || target.includes(norm)))
      .map(({ c }) => ({ id: c.id, name: c.name, title: c.title, email: c.email }));
    if (matches.length > 0) {
      job.warmContacts = matches;
    }
  }
}

/** Saved searches whose cadence has elapsed since their last released discovery claim. */
export async function dueSavedSearches(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  now: Date,
): Promise<AgendaDueQuery[]> {
  if (config.savedSearches.length === 0) return [];
  const latest = await latestClaimBySubject(
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
    if (claimDamped(latest.get(sq.query), now, sq.checkEveryHours * HOUR_MS)) continue;
    due.push({ query: sq.query, board: sq.board, resumeId: sq.resumeId });
  }
  return due;
}
