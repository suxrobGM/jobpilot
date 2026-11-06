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
import { FeedService } from "@/modules/feed/feed.service";
import { queuedJobRows } from "@/modules/feed/feed.utils";
import { JOB_INCLUDE, toJob } from "@/modules/feed/jobs/job-row";
import { findRecentPostings } from "@/modules/feed/jobs/recent-postings";
import { boardFilter } from "@/modules/job-board/board-host";
import { shadowedJobIds } from "./shadowed-jobs";

/** Outreach lives in Networking → Messages, so its feeds stay out of the Pipeline. */
const JOB_FEEDS = { kind: { not: "networking" } } satisfies Prisma.FeedWhereInput;

/** Upwork jobs get proposals, not applications; they show only when the Upwork board is picked. */
const UPWORK = "upwork.com";

const PIPELINE_INCLUDE = {
  ...JOB_INCLUDE,
  feed: { select: { id: true, name: true } },
} satisfies Prisma.JobInclude;

@injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly feeds = inject(FeedService),
  ) {}

  /** The rows a further-along copy of the same posting hides; few, since only repeats count. */
  private async shadowed(userId: string): Promise<string[]> {
    const repeated = await this.prisma.job.groupBy({
      by: ["url"],
      where: { userId, feed: JOB_FEEDS },
      having: { url: { _count: { gt: 1 } } },
    });
    if (repeated.length === 0) return [];
    const rows = await this.prisma.job.findMany({
      where: { userId, feed: JOB_FEEDS, url: { in: repeated.map((row) => row.url) } },
      select: { id: true, url: true, status: true, updatedAt: true },
    });
    return shadowedJobIds(rows);
  }

  private async where(userId: string, filters: PipelineFilters): Promise<Prisma.JobWhereInput> {
    const { feedId, board, search } = filters;
    const boardWhere: Prisma.JobWhereInput = board
      ? { board: boardFilter(board) }
      : { NOT: { board: boardFilter(UPWORK) } };
    return {
      userId,
      feed: JOB_FEEDS,
      id: { notIn: await this.shadowed(userId) },
      ...(feedId && { feedId }),
      ...boardWhere,
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
      this.prisma.job.findMany({
        where,
        include: PIPELINE_INCLUDE,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...pageSlice(query),
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(rows.map(toJob), query, total);
  }

  async counts(userId: string, filters: PipelineFilters) {
    const groups = await this.prisma.job.groupBy({
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
    const [feed, existing] = await Promise.all([
      this.feeds.ensure(userId, "links"),
      findRecentPostings(this.prisma, userId, normalized),
    ]);
    const fresh = normalized.filter((url) => !existing.has(url));
    if (fresh.length > 0) {
      await this.prisma.job.createMany({
        data: queuedJobRows(userId, feed.id, fresh),
      });
    }
    return { feedId: feed.id, added: fresh.length, duplicates: [...existing] };
  }
}
