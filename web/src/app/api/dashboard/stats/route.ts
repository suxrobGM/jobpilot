import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { STAGES, type ApplicationSource, type Stage } from "@/lib/schemas/application";
import type { DashboardStats } from "@/types/api";

const POSITIVE_STAGES: Stage[] = [
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
];

export async function GET() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = new Date(now - 7 * day);
  const last30 = new Date(now - 30 * day);

  const [total, last7Days, last30Days, byStageRows, byBoardRows, bySourceRows, positiveCount] =
    await Promise.all([
      db.application.count(),
      db.application.count({ where: { appliedAt: { gte: last7 } } }),
      db.application.count({ where: { appliedAt: { gte: last30 } } }),
      db.application.groupBy({ by: ["stage"], _count: { _all: true } }),
      db.application.groupBy({
        by: ["board"],
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
      }),
      db.application.groupBy({ by: ["source"], _count: { _all: true } }),
      db.application.count({
        where: { stage: { in: POSITIVE_STAGES } },
      }),
    ]);

  const byStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = 0;
      return acc;
    },
    {} as Record<Stage, number>,
  );
  for (const row of byStageRows) {
    byStage[row.stage as Stage] = row._count._all;
  }

  const byBoard = byBoardRows
    .filter((r) => r.board)
    .map((r) => ({ board: r.board as string, count: r._count._all }));

  const bySource = bySourceRows.map((r) => ({
    source: r.source as ApplicationSource,
    count: r._count._all,
  }));

  const stats: DashboardStats = {
    total,
    last7Days,
    last30Days,
    positiveResponseRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
    byStage,
    byBoard,
    bySource,
  };

  return ok(stats);
}
