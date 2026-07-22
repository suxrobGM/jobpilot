import { type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig } from "@/modules/campaign/campaign.config";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import {
  CRASH_RETRY_MS,
  GATHER_CAP,
  HUNGRY_RERUN_MS,
  SCORE_PENDING_BATCH,
  SCORE_PENDING_COOLDOWN_MS,
  SEARCH_CLAIM_COOLDOWN_MS,
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
  if (campaigns.length === 0) {
    return [];
  }

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

export interface DuePilotSearches {
  due: AgendaDueQuery[];
  /** Earliest nextRunAt across live (non-parked) searches - the idle sleep clamps to it. */
  nextSearchRunAt: Date | null;
}

/**
 * Searches whose `nextRunAt` has come due, plus a hungry-override fallback when nothing is due but
 * apply headroom remains. The claim damper is an in-flight/crash guard only; cadence lives in
 * `nextRunAt`, owned by scheduleNextRun.
 */
export async function duePilotSearches(
  prisma: PrismaClient,
  userId: string,
  config: PilotInstructionsConfig,
  now: Date,
  appliedToday: number,
): Promise<DuePilotSearches> {
  const rows = await prisma.pilotSearch.findMany({
    where: { userId },
    orderBy: { nextRunAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      query: true,
      board: true,
      resumeId: true,
      nextRunAt: true,
      lastRunAt: true,
    },
  });
  const parked = new Set(config.parkedBoards);
  // A search targeting a parked board is suppressed until the user un-parks it.
  const live = rows.filter((r) => !(r.board && parked.has(r.board)));
  if (live.length === 0) return { due: [], nextSearchRunAt: null };

  const ids = live.map((r) => r.id);
  const [latest, existing] = await Promise.all([
    latestClaimBySubject(prisma, userId, "search.discover", ids),
    // Reuse each search's campaign so discovery doesn't spawn duplicates. Keyed by the search id the
    // campaign was created under, so rewriting a search's query can't orphan it. All searches, not
    // just due ones - same round-trip.
    prisma.campaign.findMany({
      where: { userId, status: "in_progress", source: "auto_apply", pilotSearchId: { in: ids } },
      orderBy: { startedAt: "asc" },
      select: { campaignId: true, pilotSearchId: true },
    }),
  ]);

  // Ascending order ⇒ the newest campaign wins the overwrite.
  const campaignBySearch = new Map(existing.map((c) => [c.pilotSearchId, c.campaignId]));
  const claimable = (r: (typeof live)[number]) =>
    !claimDamped(latest.get(r.id), now, SEARCH_CLAIM_COOLDOWN_MS);
  const toEntry = (r: (typeof live)[number]): AgendaDueQuery => ({
    searchId: r.id,
    query: r.query,
    board: r.board ?? undefined,
    resumeId: r.resumeId ?? undefined,
    campaignId: campaignBySearch.get(r.id),
  });

  // Rows arrive ordered by nextRunAt and `live` is an order-preserving filter, so the head is the earliest.
  const nextSearchRunAt = live[0].nextRunAt;

  const due = live.filter((r) => r.nextRunAt <= now && claimable(r)).map(toEntry);
  if (due.length > 0) return { due, nextSearchRunAt };

  // Hungry override: cap unspent, so re-run the most-overdue search idle at least HUNGRY_RERUN_MS.
  if (appliedToday < config.dailyApplyCap) {
    const floor = now.getTime() - HUNGRY_RERUN_MS;
    const hungry = live.find(
      (r) => claimable(r) && (r.lastRunAt == null || r.lastRunAt.getTime() < floor),
    );
    if (hungry) return { due: [toEntry(hungry)], nextSearchRunAt };
  }
  return { due: [], nextSearchRunAt };
}
