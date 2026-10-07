import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP, latestRun, latestRunBySubject, ranRecently } from "./run-history";

/** With apply room left, an idle search reruns early, and setup refills, at most this often. */
const HUNGRY_RERUN_MS = 6 * HOUR_MS;
/** Holds back a search whose last run is open, crashed, or unreported. */
const SEARCH_RUN_COOLDOWN_MS = 2 * HOUR_MS;

export type DueSearch = Pick<
  TaskPayload<"search.discover">,
  "searchId" | "query" | "board" | "resumeId" | "campaignId"
>;

/**
 * Searches whose `nextRunAt` has come due. When none are and the apply cap still has room, the most
 * overdue idle search runs anyway.
 */
export async function gatherDueSearches(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  hungry: boolean,
): Promise<{ dueQueries: DueSearch[]; nextSearchRunAt: Date | null }> {
  const searches = await prisma.pilotSearch.findMany({
    where: { userId },
    orderBy: { nextRunAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      query: true,
      board: true,
      resumeId: true,
      nextRunAt: true,
      lastRunAt: true,
    },
  });
  if (searches.length === 0) return { dueQueries: [], nextSearchRunAt: null };

  const ids = searches.map((search) => search.id);
  const [latest, campaigns] = await Promise.all([
    latestRunBySubject(prisma, userId, "search.discover", ids),
    // Keyed by search id, not query, so a rewritten query still reuses its campaign.
    prisma.campaign.findMany({
      where: { userId, status: "in_progress", source: "auto_apply", pilotSearchId: { in: ids } },
      orderBy: { startedAt: "asc" },
      select: { campaignId: true, pilotSearchId: true },
    }),
  ]);

  // Oldest first, so the newest campaign of a search wins the map entry.
  const campaignBySearch = new Map(campaigns.map((c) => [c.pilotSearchId, c.campaignId]));
  const startable = searches.filter((search) => {
    const last = latest.get(search.id);
    // A run report or a query rewrite moves `nextRunAt` past the run, and the cadence takes over.
    const rescheduled = last?.finishedAt != null && search.nextRunAt > last.startedAt;
    return rescheduled || !ranRecently(last, now, SEARCH_RUN_COOLDOWN_MS);
  });

  let due = startable.filter((search) => search.nextRunAt <= now);
  if (due.length === 0 && hungry) {
    const idleSince = now.getTime() - HUNGRY_RERUN_MS;
    due = startable
      .filter((search) => !search.lastRunAt || search.lastRunAt.getTime() < idleSince)
      .slice(0, 1);
  }
  return {
    dueQueries: due.map((search) => ({
      searchId: search.id,
      query: search.query,
      board: search.board ?? undefined,
      resumeId: search.resumeId ?? undefined,
      campaignId: campaignBySearch.get(search.id),
    })),
    nextSearchRunAt: searches[0].nextRunAt,
  };
}

/** The setup task, unless a recent attempt says to wait: a failing agent would loop on it. */
export async function gatherSetup(
  prisma: PrismaClient,
  userId: string,
  payload: TaskPayload<"search.setup">,
  now: Date,
): Promise<TaskPayload<"search.setup"> | null> {
  const last = await latestRun(prisma, userId, "search.setup");
  return ranRecently(last, now, HUNGRY_RERUN_MS) ? null : payload;
}
