import { campaignConfigSchema, campaignSummarySchema } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import { BOARD_HEALTH_MIN_FAILURES } from "./constants";
import type {
  AgendaBoardHealth,
  AgendaQueueDrain,
  AgendaRescanSkipped,
  AgendaRetryFailed,
  AgendaStrategyReview,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recent apply outcomes scanned for board health; capped so one busy board can't crowd out the rest. */
const BOARD_HEALTH_SCAN = 500;
const BOARD_HEALTH_WINDOW = 50;
/** A campaign converts poorly below this qualified/totalFound ratio. */
const STRATEGY_MIN_JOBS = 20;
const STRATEGY_MAX_RATIO = 0.2;
const RESCAN_MIN_SKIPPED = 5;
const RETRY_MIN_FAILED = 3;

/** Oldest-first pending queue entries (≤5) plus the total pending count. */
export async function gatherQueueDrain(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaQueueDrain> {
  const where = { profileId, status: "pending" } as const;
  const [rows, pendingCount] = await Promise.all([
    prisma.queueEntry.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, url: true },
    }),
    prisma.queueEntry.count({ where }),
  ]);
  return { entries: rows, pendingCount };
}

/**
 * Boards whose most recent apply outcomes are a failure streak of {@link BOARD_HEALTH_MIN_FAILURES}+.
 * Only applied/failed rows count (skipped jobs are never attempted, so they carry no board signal); a
 * single applied breaks the streak. Parked boards are excluded. Sorted most-failed first.
 */
export async function gatherBoardHealth(
  prisma: PrismaClient,
  profileId: string,
  parkedBoards: string[],
): Promise<AgendaBoardHealth[]> {
  const parked = new Set(parkedBoards);
  const rows = await prisma.job.findMany({
    where: {
      status: { in: ["applied", "failed"] },
      board: { not: null },
      campaign: { profileId },
    },
    orderBy: { createdAt: "desc" },
    take: BOARD_HEALTH_SCAN,
    select: { campaignId: true, key: true, url: true, board: true, status: true, failReason: true },
  });

  type Row = (typeof rows)[number];
  const byBoard = new Map<string, Row[]>();
  for (const r of rows) {
    const board = r.board as string;
    if (parked.has(board)) continue;
    const arr = byBoard.get(board) ?? [];
    if (arr.length < BOARD_HEALTH_WINDOW) {
      arr.push(r);
      byBoard.set(board, arr);
    }
  }

  const out: AgendaBoardHealth[] = [];
  for (const [board, jobs] of byBoard) {
    let streak = 0;
    for (const j of jobs) {
      if (j.status !== "failed") break;
      streak++;
    }
    if (streak < BOARD_HEALTH_MIN_FAILURES) continue;
    const failed = jobs.slice(0, streak);
    const probe = failed[0];
    out.push({
      board,
      consecutiveFailures: streak,
      recentFailReasons: failed
        .map((j) => j.failReason)
        .filter((r): r is string => Boolean(r))
        .slice(0, 3),
      probeJob: { campaignId: probe.campaignId, jobKey: probe.key, url: probe.url },
    });
  }
  out.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  return out;
}

/** Recent action-journal subjectIds carrying a given `detail.type` marker - the 7-day dedupe set. */
function markedSubjects(
  markers: { subjectId: string | null; detail: string }[],
  type: string,
): Set<string> {
  const ids = new Set<string>();
  for (const m of markers) {
    if (!m.subjectId) continue;
    try {
      if ((JSON.parse(m.detail) as { type?: string }).type === type) ids.add(m.subjectId);
    } catch {
      // Non-JSON detail is not a marker; ignore.
    }
  }
  return ids;
}

/** Top skip reasons for a campaign's skipped jobs (≤3, most common first). */
async function topSkipReasons(prisma: PrismaClient, campaignId: string): Promise<string[]> {
  const rows = await prisma.job.groupBy({
    by: ["skipReason"],
    where: { campaignId, status: "skipped", skipReason: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { skipReason: "desc" } },
    take: 3,
  });
  return rows.map((r) => r.skipReason).filter((r): r is string => Boolean(r));
}

/**
 * Quiet-agenda maintenance candidates from the profile's in-progress campaigns, each deduped against a
 * 7-day action-journal marker (`detail.type`). Derives counts from the persisted campaign summary.
 */
export async function gatherQuietCandidates(
  prisma: PrismaClient,
  profileId: string,
  now: Date,
): Promise<{
  strategyReviews: AgendaStrategyReview[];
  rescanSkipped: AgendaRescanSkipped[];
  retryFailed: AgendaRetryFailed[];
}> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [campaigns, markers] = await Promise.all([
    prisma.campaign.findMany({
      where: { profileId, status: "in_progress" },
      select: { campaignId: true, query: true, config: true, summary: true },
    }),
    prisma.pilotJournalEntry.findMany({
      where: { profileId, kind: "action", createdAt: { gte: since } },
      select: { subjectId: true, detail: true },
    }),
  ]);

  const strategyMarked = markedSubjects(markers, "strategyReview");
  const rescanMarked = markedSubjects(markers, "rescanSkipped");
  const retryMarked = markedSubjects(markers, "retryFailed");

  const strategyReviews: AgendaStrategyReview[] = [];
  const rescanSkipped: AgendaRescanSkipped[] = [];
  const retryFailed: AgendaRetryFailed[] = [];

  for (const c of campaigns) {
    const summary = campaignSummarySchema.parse(JSON.parse(c.summary));

    if (
      summary.totalFound >= STRATEGY_MIN_JOBS &&
      summary.qualified / summary.totalFound < STRATEGY_MAX_RATIO &&
      !strategyMarked.has(c.campaignId)
    ) {
      const config = campaignConfigSchema.parse(JSON.parse(c.config));
      strategyReviews.push({
        campaignId: c.campaignId,
        query: c.query,
        minScore: config.minScore ?? null,
        board: config.board ?? null,
        counts: {
          totalFound: summary.totalFound,
          qualified: summary.qualified,
          applied: summary.applied,
          skipped: summary.skipped,
        },
        topSkipReasons: await topSkipReasons(prisma, c.campaignId),
      });
    }

    if (summary.skipped >= RESCAN_MIN_SKIPPED && !rescanMarked.has(c.campaignId)) {
      rescanSkipped.push({ campaignId: c.campaignId, skippedCount: summary.skipped });
    }

    if (summary.failed >= RETRY_MIN_FAILED && !retryMarked.has(c.campaignId)) {
      retryFailed.push({ campaignId: c.campaignId, failedCount: summary.failed });
    }
  }

  return { strategyReviews, rescanSkipped, retryFailed };
}
