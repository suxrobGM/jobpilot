import type { CampaignJobStatus, CampaignSummary } from "@jobpilot/contracts/campaign";
import type { Prisma } from "@/generated/prisma/client";

export function emptySummary(): CampaignSummary {
  return {
    totalFound: 0,
    qualified: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    discovered: 0,
    drafted: 0,
    sent: 0,
    replied: 0,
    bounced: 0,
  };
}

export function fold(summary: CampaignSummary, status: CampaignJobStatus, n: number): void {
  summary.totalFound += n;

  if (status !== "skipped") {
    summary.qualified += n;
  }
  if (status === "applied") {
    summary.applied += n;
  } else if (status === "failed") {
    summary.failed += n;
  } else if (status === "skipped") {
    summary.skipped += n;
  } else if (status === "approved" || status === "applying" || status === "needs_user") {
    summary.remaining += n;
  }
}

/** Derive a {@link CampaignSummary} from already-loaded job rows. Pure; no I/O. */
export function summarizeJobs(jobs: { status: string }[]): CampaignSummary {
  const summary = emptySummary();
  for (const job of jobs) {
    fold(summary, job.status as CampaignJobStatus, 1);
  }
  return summary;
}

/**
 * Recompute a campaign's {@link CampaignSummary} from its current Job-status
 * aggregates and persist it to `Campaign.summary`. Accepts a transaction client
 * or the bare prisma client.
 */
export async function recomputeCampaignSummary(
  client: Prisma.TransactionClient,
  campaignId: string,
): Promise<CampaignSummary> {
  const counts = await client.job.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });

  const summary = emptySummary();
  for (const row of counts) {
    fold(summary, row.status as CampaignJobStatus, row._count._all);
  }

  await client.campaign.update({
    where: { campaignId },
    data: { summary: JSON.stringify(summary) },
  });

  return summary;
}

/**
 * Recompute summary for an outreach campaign (`Campaign.source === "outreach"`)
 * from its OutreachMessage-status aggregates and persist it.
 */
export async function recomputeOutreachSummary(
  client: Prisma.TransactionClient,
  campaignId: string,
): Promise<CampaignSummary> {
  const [counts, contacts] = await Promise.all([
    client.outreachMessage.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    }),
    client.outreachMessage.findMany({
      where: { campaignId },
      select: { contactId: true },
      distinct: ["contactId"],
    }),
  ]);

  const summary = emptySummary();
  summary.discovered = contacts.length;
  for (const row of counts) {
    const n = row._count._all;
    summary.totalFound += n;
    switch (row.status) {
      case "draft":
      case "approved":
        summary.drafted += n;
        break;
      case "sent":
        summary.sent += n;
        break;
      case "replied":
        summary.replied += n;
        break;
      case "bounced":
        summary.bounced += n;
        break;
    }
  }

  await client.campaign.update({
    where: { campaignId },
    data: { summary: JSON.stringify(summary) },
  });

  return summary;
}
