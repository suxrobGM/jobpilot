import type { JobReason } from "@jobpilot/contracts/feed";
import { pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { inject, injectable } from "@needle-di/core";
import type { z } from "zod/v4";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { ensureFeedOwned } from "../feed.utils";
import type { jobsQuery } from "./job.schema";
import { JOB_INCLUDE, toJob } from "./job-row";

@injectable()
export class JobQueryService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async listJobs(userId: string, feedId: string, query: z.infer<typeof jobsQuery>) {
    const where: Prisma.JobWhereInput = {
      feedId,
      userId,
      status: query.status,
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { company: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };
    // The page is already ownership-scoped; the probe only tells a 404 from an empty page.
    const [, jobs, total] = await Promise.all([
      ensureFeedOwned(this.prisma, userId, feedId),
      this.prisma.job.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: { createdAt: "asc" },
        ...pageSlice(query),
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(jobs.map(toJob), query, total);
  }

  /** Grouped across every job, so the breakdown is not page-scoped. */
  async listJobReasons(userId: string, feedId: string): Promise<JobReason[]> {
    await ensureFeedOwned(this.prisma, userId, feedId);

    const [skipped, failed] = await Promise.all([
      this.prisma.job.groupBy({
        by: ["skipReason"],
        where: { feedId, status: "skipped", skipReason: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ["failReason"],
        where: { feedId, status: "failed", failReason: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return [
      ...skipped.map((row) => ({
        kind: "skipped" as const,
        reason: row.skipReason ?? "",
        count: row._count._all,
      })),
      ...failed.map((row) => ({
        kind: "failed" as const,
        reason: row.failReason ?? "",
        count: row._count._all,
      })),
    ].sort((a, b) => b.count - a.count);
  }
}
