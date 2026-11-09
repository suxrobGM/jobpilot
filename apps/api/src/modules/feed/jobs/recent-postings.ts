import { DAY_MS } from "@/common/date/buckets";
import type { JobStatus, PrismaClient } from "@/generated/prisma/client";

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

interface PostingRef {
  feedId: string;
  key: string;
  status: JobStatus;
}

/** The normalized URLs the user already has from the window, each with its newest job. */
export async function findRecentPostings(
  prisma: Pick<PrismaClient, "job">,
  userId: string,
  urls: string[],
): Promise<Map<string, PostingRef>> {
  const rows = await prisma.job.findMany({
    where: recentPostingsWhere(userId, urls),
    orderBy: { createdAt: "desc" },
    select: { url: true, feedId: true, key: true, status: true },
  });
  const found = new Map<string, PostingRef>();
  for (const { url, ...ref } of rows) {
    if (!found.has(url)) {
      found.set(url, ref);
    }
  }
  return found;
}
