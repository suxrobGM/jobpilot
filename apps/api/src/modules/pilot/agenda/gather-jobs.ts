import { type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig } from "@/modules/campaign/campaign.config";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import {
  CRASH_RETRY_MS,
  GATHER_CAP,
  HUNGRY_RERUN_MS,
  SCORE_PENDING_BATCH,
  SCORE_PENDING_COOLDOWN_MS,
  SEARCH_CLAIM_COOLDOWN_MS,
  WARM_INTRO_APPLIED_WINDOW_MS,
  WARM_INTRO_MIN_SCORE,
} from "./constants";
import { jobSubjectId } from "./job-mutations";
import type { AgendaApprovedJob, AgendaDueQuery, AgendaScorePending, WarmContact } from "./types";

const AGENDA_JOB_SELECT = {
  campaignId: true,
  key: true,
  title: true,
  url: true,
  board: true,
  digest: true,
  matchScore: true,
  company: true,
  campaign: { select: { config: true } },
} satisfies Prisma.JobSelect;

type AgendaJobRow = Prisma.JobGetPayload<{ select: typeof AGENDA_JOB_SELECT }>;

/** Warm-intro candidates never reach an apply item, so they skip the digest blob and campaign join. */
const WARM_INTRO_JOB_SELECT = {
  campaignId: true,
  key: true,
  title: true,
  url: true,
  matchScore: true,
  company: true,
} satisfies Prisma.JobSelect;

/** Rows → agenda jobs; jobs of one campaign share a config, parsed at most once. */
function toAgendaJobs(rows: AgendaJobRow[]): AgendaApprovedJob[] {
  const configByCampaign = new Map<string, CampaignConfig>();
  return rows.map((row) => {
    let cfg = configByCampaign.get(row.campaignId);
    if (!cfg) {
      cfg = parseCampaignConfig(row.campaign.config);
      configByCampaign.set(row.campaignId, cfg);
    }
    const { campaign: _, ...fields } = row;
    return { ...fields, resumeId: cfg.resumeId };
  });
}

/** Approved jobs of in-progress campaigns, each carrying its campaign's resumeId. */
export async function gatherApprovedJobs(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaApprovedJob[]> {
  const rows = await prisma.job.findMany({
    where: { status: "approved", campaign: { userId, status: "in_progress" } },
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: AGENDA_JOB_SELECT,
  });
  return toAgendaJobs(rows);
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

  // Rows arrive newest-first, so the first row per subject wins.
  const latest = new Map<string, LatestClaim>();
  for (const { subjectId, ...claim } of claims) {
    if (!latest.has(subjectId)) latest.set(subjectId, claim);
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

/** Campaigns whose newest claim of `kind` no longer damps them - see {@link claimDamped}. */
export async function claimableCampaigns<T extends { campaignId: string }>(
  prisma: PrismaClient,
  userId: string,
  kind: string,
  cooldownMs: number,
  now: Date,
  campaigns: T[],
): Promise<T[]> {
  if (campaigns.length === 0) {
    return [];
  }
  const latest = await latestClaimBySubject(
    prisma,
    userId,
    kind,
    campaigns.map((c) => c.campaignId),
  );
  return campaigns.filter((c) => !claimDamped(latest.get(c.campaignId), now, cooldownMs));
}

/** Pending rows a worker must open the posting for: never scored, or scored off a results row and
 *  left without the digest the public index needs. Terminal rows are out - PATCH refuses them. */
const NEEDS_WORKER_VISIT = {
  status: "pending",
  OR: [{ matchScore: null }, { digest: null }],
} satisfies Prisma.JobWhereInput;

/**
 * In-progress auto-apply campaigns carrying rows matching {@link NEEDS_WORKER_VISIT}. Each carries
 * ≤{@link SCORE_PENDING_BATCH} sampled entries plus the total backlog count.
 *
 * Rate-limited per campaign off claim history, like {@link dueSavedSearches}: a row nothing can visit
 * (dead URL, login wall) stays a candidate forever, and scorePending outranks discovery - without a
 * cooldown that one row would re-win every cycle and starve discovery permanently.
 */
export async function gatherScorePendingCampaigns(
  prisma: PrismaClient,
  userId: string,
  fallbackMinScore: number,
  now: Date,
): Promise<AgendaScorePending[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      source: "auto_apply",
      jobs: { some: NEEDS_WORKER_VISIT },
    },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      query: true,
      config: true,
      // Total backlog beside the sampled entries, without a second round trip.
      _count: { select: { jobs: { where: NEEDS_WORKER_VISIT } } },
      jobs: {
        where: NEEDS_WORKER_VISIT,
        orderBy: { createdAt: "asc" },
        take: SCORE_PENDING_BATCH,
        select: { key: true, url: true, title: true },
      },
    },
  });

  const claimable = await claimableCampaigns(
    prisma,
    userId,
    "campaign.scorePending",
    SCORE_PENDING_COOLDOWN_MS,
    now,
    campaigns,
  );
  return claimable.map((c) => {
    const config = parseCampaignConfig(c.config);
    return {
      campaignId: c.campaignId,
      query: c.query,
      board: config.board ?? null,
      resumeId: config.resumeId,
      minScore: config.minScore ?? fallbackMinScore,
      pendingCount: c._count.jobs,
      entries: c.jobs,
    };
  });
}

/**
 * Warm-intro candidates: approved jobs at/above the floor plus recently-applied ones - applying
 * (which outranks the intro) would otherwise drain the pool before an intro ever fires. Claim
 * damping stops a done intro from re-firing inside the window.
 */
export async function gatherWarmIntroCandidates(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  approvedJobs: AgendaApprovedJob[],
): Promise<AgendaApprovedJob[]> {
  const applied = await prisma.job.findMany({
    where: {
      status: "applied",
      appliedAt: { gte: new Date(now.getTime() - WARM_INTRO_APPLIED_WINDOW_MS) },
      matchScore: { gte: WARM_INTRO_MIN_SCORE },
      campaign: { userId },
    },
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: WARM_INTRO_JOB_SELECT,
  });

  // A job holds one status, so the approved and applied halves can never overlap.
  const candidates: AgendaApprovedJob[] = [
    ...approvedJobs.filter((j) => (j.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE),
    ...applied.map((row) => ({ ...row, board: null, digest: null })),
  ];
  if (candidates.length === 0) return [];

  const latest = await latestClaimBySubject(
    prisma,
    userId,
    "networking.warmIntro",
    candidates.map(jobSubjectId),
  );
  return candidates
    .filter((j) => !claimDamped(latest.get(jobSubjectId(j)), now, WARM_INTRO_APPLIED_WINDOW_MS))
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

/** Attach same-company contacts (with an email) to every job that names a company. Ungated on score:
 *  one contacts read covers the whole list, and a known insider is worth naming at any score. */
export async function attachWarmContacts(
  prisma: PrismaClient,
  userId: string,
  jobs: AgendaApprovedJob[],
): Promise<void> {
  const withCompany = jobs.filter((j) => j.company);
  if (withCompany.length === 0) {
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

  for (const job of withCompany) {
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
  /** Earliest nextRunAt across all searches - the idle sleep clamps to it. */
  nextSearchRunAt: Date | null;
}

/**
 * Searches whose `nextRunAt` has come due, plus a hungry-override fallback when nothing is due but
 * the daily apply cap has room left. The claim damper is a crash guard only; cadence lives in
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
  if (rows.length === 0) {
    return { due: [], nextSearchRunAt: null };
  }

  const ids = rows.map((r) => r.id);
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
  const claimable = (r: (typeof rows)[number]) =>
    !claimDamped(latest.get(r.id), now, SEARCH_CLAIM_COOLDOWN_MS);
  const toEntry = (r: (typeof rows)[number]): AgendaDueQuery => ({
    searchId: r.id,
    query: r.query,
    board: r.board ?? undefined,
    resumeId: r.resumeId ?? undefined,
    campaignId: campaignBySearch.get(r.id),
  });

  // Rows arrive ordered by nextRunAt, so the head is the earliest.
  const nextSearchRunAt = rows[0].nextRunAt;

  const due = rows.filter((r) => r.nextRunAt <= now && claimable(r)).map(toEntry);
  if (due.length > 0) {
    return { due, nextSearchRunAt };
  }

  // Hungry override: cap unspent, so re-run the most-overdue search idle at least HUNGRY_RERUN_MS.
  if (appliedToday < config.dailyApplyCap) {
    const floor = now.getTime() - HUNGRY_RERUN_MS;
    const hungry = rows.find(
      (r) => claimable(r) && (r.lastRunAt == null || r.lastRunAt.getTime() < floor),
    );
    if (hungry) {
      return { due: [toEntry(hungry)], nextSearchRunAt };
    }
  }
  return { due: [], nextSearchRunAt };
}
