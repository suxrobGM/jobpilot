import type { CampaignJobReason, CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ensureCampaignOwned } from "../campaign.utils";

export interface JobListQuery extends PaginationQuery {
  status?: CampaignJobStatus;
  search?: string;
}

export async function listCampaignJobs(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  query: JobListQuery,
) {
  const where: Prisma.JobWhereInput = {
    campaignId,
    campaign: { userId },
    status: query.status,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { company: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  // The page is already ownership-scoped; the probe only separates 404 from an empty page, so
  // it rides along rather than costing a round trip of its own.
  const [, jobs, total] = await Promise.all([
    ensureCampaignOwned(prisma, userId, campaignId),
    prisma.job.findMany({ where, orderBy: { createdAt: "asc" }, ...pageSlice(query) }),
    prisma.job.count({ where }),
  ]);
  return paginate(jobs, query, total);
}

/** Skip/fail reasons grouped by frequency across every job, so the breakdown is not page-scoped. */
export async function listCampaignJobReasons(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
): Promise<CampaignJobReason[]> {
  await ensureCampaignOwned(prisma, userId, campaignId);

  const [skipped, failed] = await Promise.all([
    prisma.job.groupBy({
      by: ["skipReason"],
      where: { campaignId, status: "skipped", skipReason: { not: null } },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["failReason"],
      where: { campaignId, status: "failed", failReason: { not: null } },
      _count: { _all: true },
    }),
  ]);

  // The `{ not: null }` guards above make the reason non-null on every row.
  return [
    ...skipped.map((row) => ({
      kind: "skipped" as const,
      reason: row.skipReason as string,
      count: row._count._all,
    })),
    ...failed.map((row) => ({
      kind: "failed" as const,
      reason: row.failReason as string,
      count: row._count._all,
    })),
  ].sort((a, b) => b.count - a.count);
}
