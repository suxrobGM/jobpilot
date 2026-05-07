import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import type { RunDto, RunStatsDto } from "@/types/api";

interface RunRow {
  runId: string;
  query: string;
  source: string;
  status: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  config: string;
  summary: string;
}

interface SummaryShape {
  applied?: number;
  failed?: number;
  skipped?: number;
}

function rowToDto(r: RunRow): RunDto {
  return {
    ...r,
    startedAt: r.startedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    config: JSON.parse(r.config) as RunDto["config"],
    summary: JSON.parse(r.summary) as RunDto["summary"],
  } as RunDto;
}

export async function GET() {
  const [runs, byBoardRows, failReasonRows] = await Promise.all([
    db.run.findMany({ orderBy: { startedAt: "desc" } }),
    db.runJob.groupBy({
      by: ["board"],
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
    }),
    db.runJob.groupBy({
      by: ["failReason"],
      where: { failReason: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  let totalApplied = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  for (const r of runs) {
    const s = JSON.parse(r.summary) as SummaryShape;
    totalApplied += s.applied ?? 0;
    totalFailed += s.failed ?? 0;
    totalSkipped += s.skipped ?? 0;
  }

  const total = totalApplied + totalFailed + totalSkipped;
  const successRate = total > 0 ? Math.round((totalApplied / total) * 100) : 0;

  const stats: RunStatsDto = {
    totalRuns: runs.length,
    totalApplied,
    totalFailed,
    totalSkipped,
    successRate,
    byBoard: byBoardRows
      .filter((r) => r.board)
      .map((r) => ({ board: r.board as string, count: r._count._all })),
    failReasons: failReasonRows
      .filter((r) => r.failReason)
      .map((r) => ({ reason: r.failReason as string, count: r._count._all })),
    recentRuns: runs.slice(0, 10).map(rowToDto),
  };

  return ok(stats);
}
