import { startOfDay } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { classifySkipReason, type SkipBucket } from "./skip-reasons";

export interface PilotTodayOutcomes {
  skipped: number;
  failed: number;
  /** Buckets, most frequent first. Empty when nothing was skipped today. */
  skipReasons: { reason: SkipBucket; count: number }[];
}

/** Excludes applied on purpose: pilot state already reports that from `Application`. */
export async function countTodayOutcomes(
  prisma: Pick<PrismaClient, "job">,
  userId: string,
  now: Date,
): Promise<PilotTodayOutcomes> {
  const where = { campaign: { userId }, updatedAt: { gte: startOfDay(now) } };

  const [byStatus, skippedRows] = await Promise.all([
    prisma.job.groupBy({
      by: ["status"],
      where: { ...where, status: { in: ["skipped", "failed"] } },
      _count: { _all: true },
    }),
    // A day's skips are tens of rows, and the bucketing rule can't run in SQL.
    prisma.job.findMany({
      where: { ...where, status: "skipped", skipReason: { not: null } },
      select: { skipReason: true },
    }),
  ]);

  const counts = new Map<SkipBucket, number>();
  for (const row of skippedRows) {
    const bucket = classifySkipReason(row.skipReason ?? "");
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const statusCount = (status: "skipped" | "failed") =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    skipped: statusCount("skipped"),
    failed: statusCount("failed"),
    skipReasons: [...counts]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
