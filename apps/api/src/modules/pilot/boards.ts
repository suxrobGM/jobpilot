import type { PrismaClient } from "@/generated/prisma/client";
import { boardDomain } from "@/modules/job-board/board-host";

export async function linkedBoardDomains(
  prisma: PrismaClient,
  userId: string,
): Promise<Set<string>> {
  const rows = await prisma.userJobBoard.findMany({
    where: { userId },
    select: { board: { select: { domain: true } } },
  });
  return new Set(rows.map((row) => boardDomain(row.board.domain) ?? row.board.domain));
}

/** Splits instructions `boards` into linked and unconfigured entries, order preserved. */
export function partitionBoards(boards: string[], linked: ReadonlySet<string>) {
  const usable: string[] = [];
  const skipped: string[] = [];
  for (const board of boards) {
    (linked.has(boardDomain(board) ?? board) ? usable : skipped).push(board);
  }
  return { usable, skipped };
}
