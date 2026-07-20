import type { PrismaClient } from "@/generated/prisma/client";
import { BOARD_HEALTH_MIN_FAILURES, REASON_CAP } from "./constants";
import type { AgendaBoardHealth } from "./types";

const BOARD_HEALTH_SCAN = 500;
const BOARD_HEALTH_WINDOW = 50;

/** Finds boards with a recent consecutive apply-failure streak. */
export async function gatherBoardHealth(
  prisma: PrismaClient,
  userId: string,
  parkedBoards: string[],
): Promise<AgendaBoardHealth[]> {
  const parked = new Set(parkedBoards);
  const rows = await prisma.job.findMany({
    where: {
      status: { in: ["applied", "failed"] },
      board: { not: null },
      campaign: { userId },
    },
    orderBy: { createdAt: "desc" },
    take: BOARD_HEALTH_SCAN,
    select: { campaignId: true, key: true, url: true, board: true, status: true, failReason: true },
  });

  type Row = (typeof rows)[number];
  const byBoard = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.board || parked.has(row.board)) continue;
    const boardRows = byBoard.get(row.board) ?? [];
    if (boardRows.length < BOARD_HEALTH_WINDOW) {
      boardRows.push(row);
      byBoard.set(row.board, boardRows);
    }
  }

  const candidates: AgendaBoardHealth[] = [];
  for (const [board, jobs] of byBoard) {
    let consecutiveFailures = 0;
    for (const job of jobs) {
      if (job.status !== "failed") break;
      consecutiveFailures++;
    }
    if (consecutiveFailures < BOARD_HEALTH_MIN_FAILURES) continue;
    const failed = jobs.slice(0, consecutiveFailures);
    const probeJob = failed[0];
    candidates.push({
      board,
      consecutiveFailures,
      recentFailReasons: failed
        .map((job) => job.failReason)
        .filter((reason): reason is string => Boolean(reason))
        .slice(0, REASON_CAP),
      probeJob: {
        campaignId: probeJob.campaignId,
        jobKey: probeJob.key,
        url: probeJob.url,
      },
    });
  }
  return candidates.sort((left, right) => right.consecutiveFailures - left.consecutiveFailures);
}
