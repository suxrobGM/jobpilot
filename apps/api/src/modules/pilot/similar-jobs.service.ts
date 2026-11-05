import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { PrismaClient } from "@/generated/prisma/client";
import { findFuzzyDuplicates } from "@/modules/scoring/applied-duplicates";
import type { SimilarJobsBody } from "./pilot.schema";

/** The fuzzy scan runs in-process, so it has to stay bounded. */
const MAX_CANDIDATES = 2000;

@injectable()
export class SimilarJobsService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** Each posting's likeliest copy in any campaign, skipped rows included. */
  async findSimilar(userId: string, body: SimilarJobsBody) {
    const rows = await this.prisma.campaignJob.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - body.withinDays * DAY_MS) } },
      orderBy: { createdAt: "desc" },
      take: MAX_CANDIDATES,
      select: {
        campaignId: true,
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
