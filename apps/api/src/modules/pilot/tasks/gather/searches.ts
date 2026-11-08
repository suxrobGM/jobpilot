import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import { GATHER_CAP, latestRun, latestRunBySubject, ranRecently } from "../../runs/run-history";
import type { GatherContext } from "./gather-context";

/** With apply room left, an idle search reruns early, and setup refills, at most this often. */
const IDLE_RERUN_MS = 6 * HOUR_MS;
/** Holds back a search whose last run is open, crashed, or unreported. */
const SEARCH_RUN_COOLDOWN_MS = 2 * HOUR_MS;

export type DueSearch = Pick<
  TaskPayload<"search.discover">,
  "searchId" | "query" | "board" | "resumeId"
>;

/**
 * Searches whose `nextRunAt` has come due. When none are and the apply cap still has room, the most
 * overdue idle search runs anyway. A paused search never runs.
 */
export async function gatherDueSearches(
  ctx: GatherContext,
  canApplyMore: boolean,
): Promise<{ dueQueries: DueSearch[]; nextSearchRunAt: Date | null }> {
  const { prisma, userId, now } = ctx;
  const searches = await prisma.feed.findMany({
    where: { userId, kind: "search", pausedAt: null, archivedAt: null },
    orderBy: { nextRunAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      query: true,
      board: { select: { domain: true } },
      resumeId: true,
      nextRunAt: true,
      lastRunAt: true,
    },
  });
  if (searches.length === 0) {
    return { dueQueries: [], nextSearchRunAt: null };
  }

  const latest = await latestRunBySubject(
    ctx,
    "search.discover",
    searches.map((search) => search.id),
  );
  const startable = searches.filter((search) => {
    const last = latest.get(search.id);
    // A run report or a query rewrite moves `nextRunAt` past the run, and the cadence takes over.
    const rescheduled = last?.finishedAt != null && search.nextRunAt > last.startedAt;
    return rescheduled || !ranRecently(last, now, SEARCH_RUN_COOLDOWN_MS);
  });

  let due = startable.filter((search) => search.nextRunAt <= now);
  if (due.length === 0 && canApplyMore) {
    const idleSince = now.getTime() - IDLE_RERUN_MS;
    due = startable
      .filter((search) => !search.lastRunAt || search.lastRunAt.getTime() < idleSince)
      .slice(0, 1);
  }
  return {
    dueQueries: due.map((search) => ({
      searchId: search.id,
      query: search.query ?? "",
      board: search.board?.domain,
      resumeId: search.resumeId ?? undefined,
    })),
    nextSearchRunAt: searches[0].nextRunAt,
  };
}

interface SetupInput {
  minScore: number;
  searchCount: number;
}

/** The setup task, unless a recent attempt says to wait: a failing agent would loop on it. */
export async function gatherSetup(
  ctx: GatherContext,
  input: SetupInput,
): Promise<TaskPayload<"search.setup"> | null> {
  const { prisma, userId, now } = ctx;
  // With no searches the first ones come from the resume.
  const needsResume = input.searchCount === 0;
  const [last, resumeCount] = await Promise.all([
    latestRun(ctx, "search.setup"),
    needsResume ? prisma.resume.count({ where: { userId } }) : null,
  ]);
  const noStart = needsResume && resumeCount === 0;
  if (noStart || ranRecently(last, now, IDLE_RERUN_MS)) {
    return null;
  }
  return { minScore: input.minScore };
}
