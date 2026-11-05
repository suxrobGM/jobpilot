import { pageSlice, paginate } from "@jobpilot/contracts/pagination";
import {
  PIPELINE_VIEW_STATUSES,
  type PipelineFilters,
  type PipelineJobsQuery,
  type PipelineJobView,
} from "@jobpilot/contracts/pipeline";
import { inject, injectable } from "@needle-di/core";
import { normalizeJobUrl } from "@/common/utils/url";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "@/modules/campaign/campaign.service";
import { queuedJobRows } from "@/modules/campaign/campaign.utils";
import { JOB_INCLUDE, toCampaignJob } from "@/modules/campaign/jobs/job-row";
import { findRecentPostings } from "@/modules/campaign/jobs/recent-postings";
import { boardFilter } from "@/modules/job-board/board-host";
import { shadowedJobIds } from "./shadowed-jobs";

/** Outreach lives in Networking → Messages, so its campaigns stay out of the Pipeline. */
const JOB_CAMPAIGNS = { source: { not: "networking" } } satisfies Prisma.CampaignWhereInput;

const PIPELINE_INCLUDE = {
  ...JOB_INCLUDE,
  campaign: { select: { id: true, query: true } },
} satisfies Prisma.CampaignJobInclude;

@injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly campaigns = inject(CampaignService),
  ) {}

  /** The rows a further-along copy of the same posting hides; few, since only repeats count. */
  private async shadowed(userId: string): Promise<string[]> {
    const repeated = await this.prisma.campaignJob.groupBy({
      by: ["url"],
      where: { userId, campaign: JOB_CAMPAIGNS },
      having: { url: { _count: { gt: 1 } } },
    });
    if (repeated.length === 0) return [];
    const rows = await this.prisma.campaignJob.findMany({
      where: { userId, campaign: JOB_CAMPAIGNS, url: { in: repeated.map((row) => row.url) } },
      select: { id: true, url: true, status: true, updatedAt: true },
    });
    return shadowedJobIds(rows);
  }

  private async where(
    userId: string,
    filters: PipelineFilters,
  ): Promise<Prisma.CampaignJobWhereInput> {
    const { campaignId, board, search } = filters;
    return {
      userId,
      campaign: JOB_CAMPAIGNS,
      id: { notIn: await this.shadowed(userId) },
      ...(campaignId && { campaignId }),
      ...(board && { board: boardFilter(board) }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { url: { contains: search, mode: "insensitive" } },
        ],
      }),
    };
  }

  async listJobs(userId: string, query: PipelineJobsQuery) {
    const where = {
      ...(await this.where(userId, query)),
      status: { in: PIPELINE_VIEW_STATUSES[query.view] },
    };
    const [rows, total] = await Promise.all([
      this.prisma.campaignJob.findMany({
        where,
        include: PIPELINE_INCLUDE,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...pageSlice(query),
      }),
      this.prisma.campaignJob.count({ where }),
    ]);
    return paginate(rows.map(toCampaignJob), query, total);
  }

  async counts(userId: string, filters: PipelineFilters) {
    const groups = await this.prisma.campaignJob.groupBy({
      by: ["status"],
      where: await this.where(userId, filters),
      _count: { _all: true },
    });
    const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
    const count = (view: PipelineJobView) =>
      PIPELINE_VIEW_STATUSES[view].reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0);
    return {
      found: count("found"),
      toApply: count("toApply"),
      needsYou: count("needsYou"),
      skipped: count("skipped"),
      failed: count("failed"),
    } satisfies Record<PipelineJobView, number>;
  }

  /** Queues links on the standing links feed; `queue.score` picks them up like any pasted link. */
  async addLinks(userId: string, urls: string[]) {
    const normalized = [...new Set(urls.map(normalizeJobUrl))];
    const [campaign, existing] = await Promise.all([
      this.campaigns.create(userId, {
        query: "Job links",
        source: "apply",
        feed: "links",
        createdBy: "user",
      }),
      findRecentPostings(this.prisma, userId, normalized),
    ]);
    const fresh = normalized.filter((url) => !existing.has(url));
    if (fresh.length > 0) {
      await this.prisma.campaignJob.createMany({
        data: queuedJobRows(userId, campaign.id, fresh),
      });
    }
    return { campaignId: campaign.id, added: fresh.length, duplicates: [...existing] };
  }
}
