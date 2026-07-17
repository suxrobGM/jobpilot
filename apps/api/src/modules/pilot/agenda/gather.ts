import { CAMPAIGN_JOB_ACTIVE_STATUSES, type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import { parseCampaignConfig } from "./campaign-config";
import { GATHER_CAP, WARM_INTRO_MIN_SCORE } from "./constants";
import type {
  AgendaApprovedJob,
  AgendaDueQuery,
  AgendaFinalizeCampaign,
  AgendaInbox,
  AgendaQuestion,
  WarmContact,
} from "./types";

/** Answered questions not yet consumed by any lease, so a claimed answer never re-appears. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaQuestion[]> {
  const answered = await prisma.question.findMany({
    where: { profileId, status: "answered" },
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
      profileId,
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
  profileId: string,
  parkedBoards: string[] = [],
): Promise<AgendaApprovedJob[]> {
  const rows = await prisma.job.findMany({
    where: { status: "approved", campaign: { profileId, status: "in_progress" } },
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

/** In-progress campaigns with no active jobs left - ready to finalize. */
export function gatherFinalizeCampaigns(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaFinalizeCampaign[]> {
  return prisma.campaign.findMany({
    where: {
      profileId,
      status: "in_progress",
      jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
    },
    select: { campaignId: true, query: true },
  });
}

/** Oldest-first ids (≤10) plus total count of unclassified synced mail - the scan-inbox predicate. */
export async function gatherInbox(prisma: PrismaClient, profileId: string): Promise<AgendaInbox> {
  const where = { account: { profileId }, classification: null, reviewStatus: "pending" } as const;
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
  profileId: string,
  approvedJobs: AgendaApprovedJob[],
): Promise<void> {
  const hot = approvedJobs.filter((j) => (j.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE && j.company);
  if (hot.length === 0) return;
  const contacts = await prisma.contact.findMany({
    where: { profileId, email: { not: null }, company: { not: null } },
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
  profileId: string,
  config: PilotInstructionsConfig,
  now: Date,
): Promise<AgendaDueQuery[]> {
  if (config.savedSearches.length === 0) return [];
  // One read for every discovery lease, reduced to the latest per query - avoids an N+1 findFirst.
  const leases = await prisma.pilotLease.findMany({
    where: {
      profileId,
      kind: "search.discover",
      subjectId: { in: config.savedSearches.map((q) => q.query) },
    },
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
