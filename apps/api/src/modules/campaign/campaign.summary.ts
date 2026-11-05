import type {
  CampaignJobStatus,
  CampaignJobSummary,
  CampaignNetworkingSummary,
  CampaignSummary,
} from "@jobpilot/contracts/campaign";
import { CAMPAIGN_JOB_STATUSES } from "@jobpilot/contracts/campaign";
import {
  type Campaign,
  type CampaignSource,
  type CampaignStatus,
  type NetworkingMessageStatus,
  Prisma,
} from "@/generated/prisma/client";

type SummaryClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "campaignJob" | "networkingMessage"
>;
type CampaignRef = Pick<Campaign, "id" | "source">;

interface StatusCount {
  status: string;
  count: number;
  scored?: number;
}

export type WithSummary<T> = T & { summary: CampaignSummary };

/** Installed skills read the roll-ups (`summary.applied` gates the cap), so derive them here. */
export function jobSummary(rows: StatusCount[], networkingCount = 0): CampaignJobSummary {
  const byStatus = Object.fromEntries(CAMPAIGN_JOB_STATUSES.map((status) => [status, 0])) as Record<
    CampaignJobStatus,
    number
  >;
  let scored = 0;
  for (const row of rows) {
    byStatus[row.status as CampaignJobStatus] += row.count;
    scored += row.scored ?? 0;
  }
  const totalFound = CAMPAIGN_JOB_STATUSES.reduce((n, status) => n + byStatus[status], 0);

  return {
    kind: "jobs",
    totalFound,
    qualified: totalFound - byStatus.skipped,
    applied: byStatus.applied,
    failed: byStatus.failed,
    skipped: byStatus.skipped,
    remaining: byStatus.approved + byStatus.applying + byStatus.needs_user,
    byStatus,
    scored,
    networkingCount,
  };
}

function networkingSummary(rows: StatusCount[], discovered: number): CampaignNetworkingSummary {
  const count = (...statuses: string[]) =>
    rows.filter((row) => statuses.includes(row.status)).reduce((n, row) => n + row.count, 0);

  return {
    kind: "networking",
    discovered,
    drafted: count("draft", "approved"),
    sent: count("sent"),
    replied: count("replied"),
    bounced: count("bounced"),
  };
}

export function emptySummary(source: CampaignSource): CampaignSummary {
  return source === "networking" ? networkingSummary([], 0) : jobSummary([]);
}

/** Each campaign with its summary, derived from current rows in three aggregate queries. */
export async function summarizeCampaigns<T extends CampaignRef>(
  client: SummaryClient,
  campaigns: T[],
): Promise<WithSummary<T>[]> {
  const ids = campaigns.map((c) => c.id);
  const networkingIds = campaigns.filter((c) => c.source === "networking").map((c) => c.id);
  const jobIds = campaigns.filter((c) => c.source !== "networking").map((c) => c.id);

  const [jobCounts, messageCounts, contacts] = await Promise.all([
    jobIds.length
      ? client.campaignJob.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: jobIds } },
          // `matchScore` counts non-nulls, so `scored` rides along with the status fold.
          _count: { _all: true, matchScore: true },
        })
      : [],
    // Job campaigns included: the pilot saves warm-intro drafts against them too.
    ids.length
      ? client.networkingMessage.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: ids } },
          _count: { _all: true },
        })
      : [],
    networkingIds.length
      ? client.$queryRaw<{ campaignId: string; discovered: number }[]>(Prisma.sql`
          SELECT campaign_id AS "campaignId", COUNT(DISTINCT contact_id)::integer AS discovered
          FROM networking_messages
          WHERE campaign_id = ANY(${networkingIds}::uuid[])
          GROUP BY campaign_id
        `)
      : [],
  ]);

  return campaigns.map((campaign) => {
    const messages = messageCounts
      .filter((row) => row.campaignId === campaign.id)
      .map((row) => ({ status: row.status, count: row._count._all }));
    if (campaign.source === "networking") {
      const contact = contacts.find((row) => row.campaignId === campaign.id);
      return { ...campaign, summary: networkingSummary(messages, contact?.discovered ?? 0) };
    }
    const jobs = jobCounts
      .filter((row) => row.campaignId === campaign.id)
      .map((row) => ({
        status: row.status,
        count: row._count._all,
        scored: row._count.matchScore,
      }));
    const drafts = messages.reduce((n, row) => n + row.count, 0);
    return { ...campaign, summary: jobSummary(jobs, drafts) };
  });
}

export async function deriveCampaignSummary(
  client: SummaryClient,
  campaignId: string,
  source: CampaignSource,
): Promise<CampaignSummary> {
  const [campaign] = await summarizeCampaigns(client, [{ id: campaignId, source }]);
  return campaign.summary;
}

interface CampaignStatusCount {
  status: CampaignStatus;
  count: number;
}

interface CampaignMessageCount {
  campaignId: string;
  status: NetworkingMessageStatus;
  count: number;
}

const ACTIVE_STATUSES: CampaignStatus[] = ["in_progress", "paused"];
// Same buckets as the per-campaign networking summary, so the totals match its rows.
const DRAFTED_STATUSES: NetworkingMessageStatus[] = ["draft", "approved"];
export const ACCOUNT_SUMMARY_MESSAGE_STATUSES: NetworkingMessageStatus[] = [
  ...DRAFTED_STATUSES,
  "replied",
];

/** Whole-account dashboard totals; a page of campaign summaries only covers that page. */
export function accountSummary(
  statusCounts: CampaignStatusCount[],
  messageCounts: CampaignMessageCount[],
) {
  const total = statusCounts.reduce((n, row) => n + row.count, 0);
  const active = statusCounts
    .filter((row) => ACTIVE_STATUSES.includes(row.status))
    .reduce((n, row) => n + row.count, 0);

  let replies = 0;
  const draftsByCampaign = new Map<string, number>();
  for (const row of messageCounts) {
    if (row.status === "replied") {
      replies += row.count;
    } else if (DRAFTED_STATUSES.includes(row.status)) {
      draftsByCampaign.set(row.campaignId, (draftsByCampaign.get(row.campaignId) ?? 0) + row.count);
    }
  }
  const draftCampaignIds = [...draftsByCampaign.keys()];

  return {
    total,
    active,
    replies,
    drafts: {
      messages: [...draftsByCampaign.values()].reduce((n, count) => n + count, 0),
      campaigns: draftCampaignIds.length,
      campaignId: draftCampaignIds.length === 1 ? draftCampaignIds[0] : null,
    },
  };
}
