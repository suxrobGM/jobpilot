import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  cooldownEndsAt,
  GATHER_CAP,
  latestRun,
  latestRunBySubject,
  type RunHistory,
  ranRecently,
} from "./run-history";

/** With room left under the apply cap, a search idle this long re-runs before it is due. */
const HUNGRY_RERUN_MS = 6 * HOUR_MS;
/** Guards an in-flight or crashed run only; the cadence itself lives in `nextRunAt`. */
const SEARCH_RUN_COOLDOWN_MS = 2 * HOUR_MS;
const SETUP_RETRY_MS = DAY_MS;

export type DueSearch = Pick<
  TaskPayload<"search.discover">,
  "searchId" | "query" | "board" | "resumeId" | "campaignId"
>;

/**
 * When the earliest search can actually run. A damped search reports when its cooldown lifts, not
 * its overdue `nextRunAt`, which reads as "due now" and pins the idle sleep at its 30s floor. An
 * in-flight one is skipped: the run holding it is already awake.
 */
export function earliestSearchWake(
  searches: { id: string; nextRunAt: Date }[],
  latest: Map<string, RunHistory>,
): Date | null {
  let earliest: Date | null = null;
  for (const search of searches) {
    const last = latest.get(search.id);
    if (last && !last.finishedAt) continue;
    const liftsAt = last?.finishedAt
      ? cooldownEndsAt({ ...last, finishedAt: last.finishedAt }, SEARCH_RUN_COOLDOWN_MS)
      : null;
    const wake = liftsAt && liftsAt > search.nextRunAt ? liftsAt : search.nextRunAt;
    if (!earliest || wake < earliest) earliest = wake;
  }
  return earliest;
}

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
  const startable = searches.filter(
    (search) => !ranRecently(latest.get(search.id), now, SEARCH_RUN_COOLDOWN_MS),
  );

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
    nextSearchRunAt: earliestSearchWake(searches, latest),
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
  return ranRecently(last, now, SETUP_RETRY_MS) ? null : payload;
}
