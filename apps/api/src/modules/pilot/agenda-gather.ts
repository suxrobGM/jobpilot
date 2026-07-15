import { CAMPAIGN_JOB_ACTIVE_STATUSES, type CampaignConfig } from "@jobpilot/contracts/campaign";
import type { PilotMandateConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  AgendaApprovedJob,
  AgendaDueQuery,
  AgendaEscalation,
  AgendaFinalizeCampaign,
  AgendaInbox,
  WarmContact,
} from "./agenda/types";

/** Lowercase, strip punctuation and common company suffixes, so "Acme, Inc." ≈ "acme". */
function normalizeCompany(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|gmbh|group|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Answered escalations not yet consumed by any lease, so a claimed answer never re-appears. */
export async function gatherAnsweredEscalations(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaEscalation[]> {
  const [answered, leases] = await Promise.all([
    prisma.escalation.findMany({
      where: { profileId, status: "answered" },
      orderBy: { answeredAt: "asc" },
    }),
    prisma.pilotLease.findMany({
      where: { profileId, subjectType: "escalation" },
      select: { subjectId: true },
    }),
  ]);
  const consumed = new Set(leases.map((l) => l.subjectId));
  return answered
    .filter((e) => !consumed.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      question: e.question,
      subjectType: e.subjectType,
      subjectId: e.subjectId,
      answer: e.answer,
    }));
}

/** Approved jobs of in-progress campaigns, each carrying its campaign's resumeId. */
export async function gatherApprovedJobs(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaApprovedJob[]> {
  const rows = await prisma.job.findMany({
    where: { status: "approved", campaign: { profileId, status: "in_progress" } },
    orderBy: { matchScore: "desc" },
    include: { campaign: { select: { config: true } } },
  });
  // Jobs of the same campaign share one config; parse each campaign's JSON at most once.
  const configByCampaign = new Map<string, CampaignConfig>();
  return rows.map((job) => {
    let cfg = configByCampaign.get(job.campaignId);
    if (!cfg) {
      cfg = JSON.parse(job.campaign.config) as CampaignConfig;
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
  const hot = approvedJobs.filter((j) => (j.matchScore ?? 0) >= 85 && j.company);
  if (hot.length === 0) return;
  const contacts = await prisma.contact.findMany({
    where: { profileId, email: { not: null }, company: { not: null } },
    select: { id: true, name: true, title: true, email: true, company: true },
  });
  if (contacts.length === 0) return;
  const normalized = contacts.map((c) => ({ c, norm: normalizeCompany(c.company ?? "") }));
  for (const job of hot) {
    const target = normalizeCompany(job.company ?? "");
    if (!target) continue;
    const matches: WarmContact[] = normalized
      .filter(({ norm }) => norm.length > 0 && (norm.includes(target) || target.includes(norm)))
      .map(({ c }) => ({ id: c.id, name: c.name, title: c.title, email: c.email }));
    if (matches.length > 0) job.warmContacts = matches;
  }
}

/** Standing queries whose cadence has elapsed since their last released discovery lease. */
export async function dueStandingQueries(
  prisma: PrismaClient,
  profileId: string,
  config: PilotMandateConfig,
  now: Date,
): Promise<AgendaDueQuery[]> {
  if (config.standingQueries.length === 0) return [];
  // One read for every discovery lease, reduced to the latest per query - avoids an N+1 findFirst.
  const leases = await prisma.pilotLease.findMany({
    where: { profileId, kind: "search.discover" },
    select: { subjectId: true, grantedAt: true, releasedAt: true },
  });
  const latest = new Map<string, { grantedAt: Date; releasedAt: Date | null }>();
  for (const l of leases) {
    const prev = latest.get(l.subjectId);
    if (!prev || l.grantedAt > prev.grantedAt) {
      latest.set(l.subjectId, { grantedAt: l.grantedAt, releasedAt: l.releasedAt });
    }
  }

  const due: AgendaDueQuery[] = [];
  for (const sq of config.standingQueries) {
    const last = latest.get(sq.query);
    const cadenceMs = sq.cadenceHours * 60 * 60 * 1000;
    // Due when never run, or the last run released longer ago than the cadence. An active
    // (unreleased) discovery lease means it is in progress, so it is not due.
    const isDue =
      !last || (last.releasedAt != null && now.getTime() - last.releasedAt.getTime() >= cadenceMs);
    if (isDue) due.push({ query: sq.query, board: sq.board, resumeId: sq.resumeId });
  }
  return due;
}
