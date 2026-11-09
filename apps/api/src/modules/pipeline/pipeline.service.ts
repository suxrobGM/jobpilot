import { feedConfigSchema, type JobStatus } from "@jobpilot/contracts/feed";
import { MAX_PAGE_SIZE, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { pilotConfigSchema } from "@jobpilot/contracts/pilot";
import {
  PIPELINE_STALE_DAYS,
  PIPELINE_VIEW_STATUSES,
  type PipelineBulkInput,
  type PipelineFilters,
  type PipelineJobsQuery,
  type PipelineJobView,
} from "@jobpilot/contracts/pipeline";
import { UPWORK_DOMAIN } from "@jobpilot/contracts/upwork";
import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { findOwned, HttpError } from "@/common/errors";
import { normalizeJobUrl } from "@/common/utils/url";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { ApplicationService } from "@/modules/application/application.service";
import { FeedService } from "@/modules/feed/feed.service";
import { JobService } from "@/modules/feed/jobs/job.service";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import { JOB_INCLUDE, queuedJobRows, toJob } from "@/modules/feed/jobs/job-row";
import { findRecentPostings } from "@/modules/feed/jobs/recent-postings";
import { boardFilter } from "@/modules/job-board/board-host";
import { shadowedJobIds } from "./shadowed-jobs";

/** Outreach lives in Networking → Messages, so its feeds stay out of the Pipeline. */
const JOB_FEEDS = { kind: { not: "networking" } } satisfies Prisma.FeedWhereInput;

const RECENT_ORDER: Prisma.JobOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { id: "desc" }];

/** To review reads best first; rows still waiting for a score go last. */
const REVIEW_ORDER: Prisma.JobOrderByWithRelationInput[] = [
  { matchScore: { sort: "desc", nulls: "last" } },
  ...RECENT_ORDER,
];

const BULK_SKIP_REASON = "Skipped by you";
const STALE_SKIP_REASON = "Skipped by you: posting over a month old";
const REVIEW_STATUSES: JobStatus[] = PIPELINE_VIEW_STATUSES.review;

function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - PIPELINE_STALE_DAYS * DAY_MS);
}

function staleWhere(now: Date): Prisma.JobWhereInput {
  return { status: { in: REVIEW_STATUSES }, createdAt: { lt: staleCutoff(now) } };
}

const PIPELINE_INCLUDE = {
  ...JOB_INCLUDE,
  feed: { select: { id: true, name: true, config: true } },
} satisfies Prisma.JobInclude;

type PipelineRow = Prisma.JobGetPayload<{ include: typeof PIPELINE_INCLUDE }>;

/** `pilotMinScore` stands in for a feed with no bar of its own. */
function toPipelineJob(row: PipelineRow, pilotMinScore: number, now: Date) {
  const { feed, ...job } = row;
  return {
    ...toJob(job),
    feed: { id: feed.id, name: feed.name },
    minScore: feedConfigSchema.parse(feed.config).minScore ?? pilotMinScore,
    stale: REVIEW_STATUSES.includes(row.status) && row.createdAt < staleCutoff(now),
  };
}

function viewCounts(byStatus: Map<JobStatus, number>): Record<PipelineJobView, number> {
  const count = (view: PipelineJobView) =>
    PIPELINE_VIEW_STATUSES[view].reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0);
  return {
    review: count("review"),
    inProgress: count("inProgress"),
    notApplied: count("notApplied"),
    needsYou: count("needsYou"),
  };
}

@injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly feeds = inject(FeedService),
    private readonly jobs = inject(JobService),
    private readonly applications = inject(ApplicationService),
  ) {}

  /** The rows a further-along copy of the same posting hides; few, since only repeats count. */
  private async shadowedIds(userId: string): Promise<string[]> {
    const repeated = await this.prisma.job.groupBy({
      by: ["url"],
      where: { userId, feed: JOB_FEEDS },
      having: { url: { _count: { gt: 1 } } },
    });
    if (repeated.length === 0) {
      return [];
    }
    const rows = await this.prisma.job.findMany({
      where: { userId, feed: JOB_FEEDS, url: { in: repeated.map((row) => row.url) } },
      select: { id: true, url: true, status: true, updatedAt: true },
    });
    return shadowedJobIds(rows);
  }

  private async jobWhere(userId: string, filters: PipelineFilters): Promise<Prisma.JobWhereInput> {
    const { feedId, board, search } = filters;
    // Upwork jobs show only when the Upwork board is picked.
    const boardWhere: Prisma.JobWhereInput = board
      ? { board: boardFilter(board) }
      : { NOT: { board: boardFilter(UPWORK_DOMAIN) } };
    return {
      userId,
      feed: JOB_FEEDS,
      id: { notIn: await this.shadowedIds(userId) },
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

  async list(userId: string, query: PipelineJobsQuery, now = new Date()) {
    const where = {
      ...(await this.jobWhere(userId, query)),
      status: { in: PIPELINE_VIEW_STATUSES[query.view] },
    };
    const [rows, total, state] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: PIPELINE_INCLUDE,
        orderBy: query.view === "review" ? REVIEW_ORDER : RECENT_ORDER,
        ...pageSlice(query),
      }),
      this.prisma.job.count({ where }),
      this.prisma.pilotState.findUnique({ where: { userId }, select: { config: true } }),
    ]);
    const { minScore } = pilotConfigSchema.parse(state?.config ?? {});
    const items = rows.map((row) => toPipelineJob(row, minScore, now));
    return paginate(items, query, total);
  }

  /** One job by id, whatever its status, for the job page the thread links to. */
  async get(userId: string, id: string, now = new Date()) {
    const [row, state] = await Promise.all([
      findOwned(
        (where) => this.prisma.job.findFirst({ where, include: PIPELINE_INCLUDE }),
        { id, userId },
        "Job",
      ),
      this.prisma.pilotState.findUnique({ where: { userId }, select: { config: true } }),
    ]);
    const { minScore } = pilotConfigSchema.parse(state?.config ?? {});
    return toPipelineJob(row, minScore, now);
  }

  /** Needs you as refs only, for the always-mounted nav badge. */
  async needsYouRefs(userId: string) {
    return this.prisma.job.findMany({
      where: {
        ...(await this.jobWhere(userId, {})),
        status: { in: PIPELINE_VIEW_STATUSES.needsYou },
      },
      orderBy: RECENT_ORDER,
      take: MAX_PAGE_SIZE,
      select: { feedId: true, key: true },
    });
  }

  /** Runs each row through the job service, so every transition guard and event still applies. */
  async bulk(userId: string, input: PipelineBulkInput) {
    const rows = await this.prisma.job.findMany({
      where: { userId, id: { in: input.ids } },
      select: { feedId: true, key: true },
    });
    let updated = 0;
    for (const row of rows) {
      try {
        await this.applyBulkAction(userId, row.feedId, row.key, input.action);
        updated += 1;
      } catch (error) {
        // A row whose transition the job service refuses is counted out, not fatal.
        if (!(error instanceof HttpError)) {
          throw error;
        }
      }
    }
    return { updated, refused: input.ids.length - updated };
  }

  async skipStale(userId: string, filters: PipelineFilters, now = new Date()) {
    const rows = await this.prisma.job.findMany({
      where: { ...(await this.jobWhere(userId, filters)), ...staleWhere(now) },
      select: { id: true, feedId: true, key: true },
    });
    // One write for every page; the status guard refuses rows the pilot picked up meanwhile.
    const { count } = await this.prisma.job.updateMany({
      where: { id: { in: rows.map((row) => row.id) }, status: { in: REVIEW_STATUSES } },
      data: { status: "skipped", skipReason: STALE_SKIP_REASON },
    });
    for (const row of rows) {
      publishJobUpdated(userId, { ...row, status: "skipped" });
    }
    return { updated: count, refused: rows.length - count };
  }

  private applyBulkAction(
    userId: string,
    feedId: string,
    key: string,
    action: PipelineBulkInput["action"],
  ) {
    if (action === "approve") {
      return this.jobs.update(userId, feedId, key, { status: "approved" });
    }
    if (action === "retry") {
      return this.jobs.retry(userId, feedId, key, {});
    }
    return this.jobs.recordResult(userId, feedId, key, {
      outcome: "skipped",
      skipReason: BULK_SKIP_REASON,
    });
  }

  async counts(userId: string, filters: PipelineFilters, now = new Date()) {
    const allFeeds = await this.jobWhere(userId, { ...filters, feedId: undefined });
    const where = filters.feedId ? { ...allFeeds, feedId: filters.feedId } : allFeeds;
    const [groups, stale, applied] = await Promise.all([
      this.prisma.job.groupBy({
        by: ["feedId", "status"],
        where: allFeeds,
        _count: { _all: true },
      }),
      this.prisma.job.count({ where: { ...where, ...staleWhere(now) } }),
      this.applications.count(userId, filters),
    ]);
    const byFeed = new Map<string, Map<JobStatus, number>>();
    const total = new Map<JobStatus, number>();
    for (const { feedId, status, _count } of groups) {
      const statuses = byFeed.get(feedId) ?? new Map<JobStatus, number>();
      statuses.set(status, _count._all);
      byFeed.set(feedId, statuses);
      total.set(status, (total.get(status) ?? 0) + _count._all);
    }
    const picked = filters.feedId
      ? (byFeed.get(filters.feedId) ?? new Map<JobStatus, number>())
      : total;
    const feeds = [...byFeed].map(([feedId, statuses]) => ({
      feedId,
      views: viewCounts(statuses),
    }));
    return { views: viewCounts(picked), feeds, stale, applied };
  }

  /** Queues links on the standing links feed; `queue.score` picks them up like any pasted link. */
  async addLinks(userId: string, urls: string[]) {
    const normalized = [...new Set(urls.map(normalizeJobUrl))];
    const [feed, existing] = await Promise.all([
      this.feeds.ensure(userId, "links"),
      findRecentPostings(this.prisma, userId, normalized),
    ]);
    const rows = queuedJobRows(
      userId,
      feed.id,
      normalized.filter((url) => !existing.has(url)),
    );
    if (rows.length > 0) {
      await this.prisma.job.createMany({ data: rows });
    }
    const added = new Map(
      rows.map((row) => [row.url, { feedId: feed.id, key: row.key, status: "queued" as const }]),
    );
    const jobs = normalized.flatMap((url) => {
      const ref = existing.get(url) ?? added.get(url);
      return ref ? [{ url, ...ref }] : [];
    });
    return { feedId: feed.id, added: rows.length, duplicates: [...existing.keys()], jobs };
  }
}
