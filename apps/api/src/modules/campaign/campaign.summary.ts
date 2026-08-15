import type {
  CampaignJobStatus,
  CampaignJobSummary,
  CampaignNetworkingSummary,
  CampaignSummary,
} from "@jobpilot/contracts/campaign";
import { CAMPAIGN_JOB_STATUSES } from "@jobpilot/contracts/campaign";
import { type CampaignSource, Prisma } from "@/generated/prisma/client";

export type SummaryClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "job" | "networkingMessage"
>;
type ContactCount = { campaignId: string; discovered: number };

function requireJobSummary(
  summaries: Map<string, CampaignSummary>,
  campaignId: string,
): CampaignJobSummary {
  const summary = summaries.get(campaignId);
  if (summary?.kind !== "jobs") {
    throw new Error(`Missing job summary accumulator for campaign ${campaignId}.`);
  }
  return summary;
}

function requireNetworkingSummary(
  summaries: Map<string, CampaignSummary>,
  campaignId: string | null,
): CampaignNetworkingSummary {
  if (!campaignId) throw new Error("Campaign summary query returned no campaign id.");
  const summary = summaries.get(campaignId);
  if (summary?.kind !== "networking") {
    throw new Error(`Missing networking summary accumulator for campaign ${campaignId}.`);
  }
  return summary;
}

/** Returns the zero-value summary for a job campaign. */
export function emptyJobSummary(): CampaignJobSummary {
  return {
    kind: "jobs",
    totalFound: 0,
    qualified: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    byStatus: Object.fromEntries(CAMPAIGN_JOB_STATUSES.map((status) => [status, 0])) as Record<
      CampaignJobStatus,
      number
    >,
    scored: 0,
  };
}

/** Returns the zero-value summary for a networking campaign. */
export function emptyNetworkingSummary(): CampaignNetworkingSummary {
  return { kind: "networking", discovered: 0, drafted: 0, sent: 0, replied: 0, bounced: 0 };
}

function foldJob(summary: CampaignJobSummary, status: string, count: number): void {
  summary.byStatus[status as CampaignJobStatus] += count;
}

/**
 * Recomputes the six roll-ups from `byStatus`. They stay on the wire because the installed
 * agent skills read them (`summary.applied` gates the max-applications cap), but they are a
 * projection - deriving them here is what keeps them from drifting out of step with `byStatus`.
 */
function finalizeJobSummary(summary: CampaignJobSummary): CampaignJobSummary {
  const counts = summary.byStatus;
  summary.totalFound = CAMPAIGN_JOB_STATUSES.reduce((n, status) => n + counts[status], 0);
  summary.qualified = summary.totalFound - counts.skipped;
  summary.applied = counts.applied;
  summary.failed = counts.failed;
  summary.skipped = counts.skipped;
  summary.remaining = counts.approved + counts.applying + counts.needs_user;
  return summary;
}

/** Folds job rows into the public job-summary shape. */
export function summarizeJobs(jobs: { status: string }[]): CampaignJobSummary {
  const summary = emptyJobSummary();
  for (const job of jobs) foldJob(summary, job.status, 1);
  return finalizeJobSummary(summary);
}

function foldNetworking(summary: CampaignNetworkingSummary, status: string, count: number): void {
  if (status === "draft" || status === "approved") summary.drafted += count;
  else if (status === "sent") summary.sent += count;
  else if (status === "replied") summary.replied += count;
  else if (status === "bounced") summary.bounced += count;
}

/** Derives one campaign summary from current rows. */
export async function deriveCampaignSummary(
  client: SummaryClient,
  campaignId: string,
  source: CampaignSource,
): Promise<CampaignSummary> {
  const summaries = await loadCampaignSummaries(client, [{ campaignId, source }]);
  const summary = summaries.get(campaignId);
  if (!summary) throw new Error(`Missing derived summary for campaign ${campaignId}.`);
  return summary;
}

/** Derives summaries for a bounded campaign page with aggregate queries. */
export async function loadCampaignSummaries(
  client: SummaryClient,
  campaigns: { campaignId: string; source: CampaignSource }[],
): Promise<Map<string, CampaignSummary>> {
  const jobIds = campaigns
    .filter((campaign) => campaign.source !== "networking")
    .map((c) => c.campaignId);
  const networkingIds = campaigns
    .filter((campaign) => campaign.source === "networking")
    .map((c) => c.campaignId);

  const [jobCounts, messageCounts, contacts] = await Promise.all([
    jobIds.length
      ? client.job.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: jobIds } },
          // `matchScore` counts non-nulls, so `scored` rides along with the status fold.
          _count: { _all: true, matchScore: true },
        })
      : [],

    networkingIds.length
      ? client.networkingMessage.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: networkingIds } },
          _count: { _all: true },
        })
      : [],

    networkingIds.length
      ? client.$queryRaw<ContactCount[]>(Prisma.sql`
          SELECT campaign_id AS "campaignId", COUNT(DISTINCT contact_id)::integer AS discovered
          FROM networking_messages
          WHERE campaign_id IN (${Prisma.join(networkingIds)})
          GROUP BY campaign_id
        `)
      : [],
  ]);

  const summaries = new Map<string, CampaignSummary>();

  for (const id of jobIds) {
    summaries.set(id, emptyJobSummary());
  }
  for (const id of networkingIds) {
    summaries.set(id, emptyNetworkingSummary());
  }
  for (const row of jobCounts) {
    const summary = requireJobSummary(summaries, row.campaignId);
    foldJob(summary, row.status, row._count._all);
    summary.scored += row._count.matchScore;
  }
  for (const id of jobIds) {
    finalizeJobSummary(requireJobSummary(summaries, id));
  }
  for (const row of contacts) {
    requireNetworkingSummary(summaries, row.campaignId).discovered = row.discovered;
  }
  for (const row of messageCounts) {
    foldNetworking(
      requireNetworkingSummary(summaries, row.campaignId),
      row.status,
      row._count._all,
    );
  }
  return summaries;
}
