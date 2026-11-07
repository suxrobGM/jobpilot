import { feedConfigSchema } from "@jobpilot/contracts/feed";
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
import { HttpError } from "@/common/errors";
import { normalizeJobUrl } from "@/common/utils/url";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { FeedService } from "@/modules/feed/feed.service";
import { JobService } from "@/modules/feed/jobs/job.service";
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
const DAY_MS = 24 * 60 * 60 * 1000;

function staleWhere(now: Date): Prisma.JobWhereInput {
  return {
    status: { in: PIPELINE_VIEW_STATUSES.review },
    createdAt: { lt: new Date(now.getTime() - PIPELINE_STALE_DAYS * DAY_MS) },
  };
}

const PIPELINE_INCLUDE = {
  ...JOB_INCLUDE,
  feed: { select: { id: true, name: true, config: true } },
} satisfies Prisma.JobInclude;

interface JobRef {
  feedId: string;
  key: string;
}

/** A row whose transition the job service refuses is counted out, not fatal. */
async function applyToRows(
  rows: JobRef[],
  apply: (row: JobRef) => Promise<unknown>,
): Promise<number> {
  let updated = 0;
  for (const row of rows) {
    try {
      await apply(row);
      updated += 1;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return updated;
}

@injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly feeds = inject(FeedService),
    private readonly jobs = inject(JobService),
  ) {}

  /** The rows a further-along copy of the same posting hides; few, since only repeats count. */
  private async shadowedIds(userId: string): Promise<string[]> {
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

  async list(userId: string, query: PipelineJobsQuery) {
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
    const items = rows.map(({ feed, ...row }) => ({
      ...toJob(row),
      feed: { id: feed.id, name: feed.name },
      minScore: feedConfigSchema.parse(feed.config).minScore ?? minScore,
    }));
    return paginate(items, query, total);
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
    const updated = await applyToRows(rows, (row) =>
      this.applyBulkAction(userId, row.feedId, row.key, input.action),
    );
    return { updated, refused: input.ids.length - updated };
  }

  async skipStale(userId: string, filters: PipelineFilters, now = new Date()) {
    const rows = await this.prisma.job.findMany({
      where: { ...(await this.jobWhere(userId, filters)), ...staleWhere(now) },
      select: { feedId: true, key: true },
    });
    const updated = await applyToRows(rows, (row) =>
      this.jobs.recordResult(userId, row.feedId, row.key, {
        outcome: "skipped",
        skipReason: STALE_SKIP_REASON,
      }),
    );
    return { updated, refused: rows.length - updated };
  }

  private applyBulkAction(
    userId: string,
    feedId: string,
    key: string,
    action: PipelineBulkInput["action"],
  ) {
    if (action === "approve") return this.jobs.update(userId, feedId, key, { status: "approved" });
    if (action === "retry") return this.jobs.retry(userId, feedId, key, {});
    return this.jobs.recordResult(userId, feedId, key, {
      outcome: "skipped",
      skipReason: BULK_SKIP_REASON,
    });
  }

  async counts(userId: string, filters: PipelineFilters, now = new Date()) {
    const where = await this.jobWhere(userId, filters);
    const [groups, stale] = await Promise.all([
      this.prisma.job.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.job.count({ where: { ...where, ...staleWhere(now) } }),
    ]);
    const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
    const count = (view: PipelineJobView) =>
      PIPELINE_VIEW_STATUSES[view].reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0);
    const views = {
      review: count("review"),
      inProgress: count("inProgress"),
      setAside: count("setAside"),
      needsYou: count("needsYou"),
    } satisfies Record<PipelineJobView, number>;
    return { views, stale };
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
