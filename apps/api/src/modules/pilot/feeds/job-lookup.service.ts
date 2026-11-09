import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { normalizeJobUrl } from "@/common/utils/url";
import { PrismaClient } from "@/generated/prisma/client";
import { findFuzzyDuplicates } from "@/modules/scoring/applied-duplicates";
import type { ExistingJobsBody, SimilarJobsBody } from "../pilot.schema";

/** The fuzzy scan runs in-process, so it has to stay bounded. */
const MAX_CANDIDATES = 2000;

@injectable()
export class JobLookupService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** The given URLs already in one of the user's feeds from the window, compared normalized. */
  async findExisting(userId: string, body: ExistingJobsBody) {
    const normalized = body.urls.map(normalizeJobUrl);
    const rows = await this.prisma.job.findMany({
      where: {
        url: { in: [...new Set(normalized)] },
        createdAt: { gte: new Date(Date.now() - body.withinDays * DAY_MS) },
        userId,
      },
      distinct: ["url"],
      select: { url: true },
    });
    const found = new Set(rows.map((row) => row.url));
    return { existing: body.urls.filter((_, i) => found.has(normalized[i])) };
  }

  /** Each posting's likeliest copy in any feed, skipped rows included. */
  async findSimilar(userId: string, body: SimilarJobsBody) {
    const rows = await this.prisma.job.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - body.withinDays * DAY_MS) } },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES,
      select: {
        feedId: true,
        key: true,
        title: true,
        company: true,
        location: true,
        url: true,
        status: true,
      },
    });
    const matches = findFuzzyDuplicates(body.postings, rows).flatMap((hit, index) =>
      hit ? [{ index, ...hit.candidate }] : [],
    );
    return { matches };
  }
}
