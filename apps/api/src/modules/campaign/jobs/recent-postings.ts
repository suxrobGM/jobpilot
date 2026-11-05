import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";

/** Overlapping searches and feeds find the same posting; one row per posting per month. */
const DUPLICATE_WINDOW_MS = 30 * DAY_MS;

/** Where the user's rows from the window with one of these normalized URLs are. */
export function recentPostingsWhere(userId: string, urls: string[], now = new Date()) {
  return {
    userId,
    url: { in: urls },
    createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
  };
}

/** The normalized URLs the user already has from the window. */
export async function findRecentPostings(
  prisma: Pick<PrismaClient, "campaignJob">,
  userId: string,
  urls: string[],
): Promise<Set<string>> {
  const rows = await prisma.campaignJob.findMany({
    where: recentPostingsWhere(userId, urls),
    distinct: ["url"],
    select: { url: true },
  });
  return new Set(rows.map((row) => row.url));
}
