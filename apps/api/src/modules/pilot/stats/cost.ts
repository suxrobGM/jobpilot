import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";

/** Claims older than this tell you about a version of the agent you are no longer running. */
const COST_WINDOW_MS = 7 * DAY_MS;

export interface PilotKindCost {
  kind: string;
  runs: number;
  /** Typical wall clock for one run of this kind. */
  medianMs: number;
  /** Where the week actually went - runs x duration, which is what ranks the kinds. */
  totalMs: number;
  failed: number;
  /** Claims that expired or were abandoned: work paid for and thrown away. */
  abandoned: number;
}

/** Takes a sorted array. */
function median(values: number[]): number {
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return Math.round((values[mid - 1] + values[mid]) / 2);
}

function summarize(kind: string, durations: number[], outcomes: (string | null)[]): PilotKindCost {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    kind,
    runs: sorted.length,
    medianMs: median(sorted),
    totalMs: sorted.reduce((sum, ms) => sum + ms, 0),
    failed: outcomes.filter((o) => o === "failed").length,
    abandoned: outcomes.filter((o) => o === "expired" || o === "abandoned").length,
  };
}

/**
 * Where the pilot's time goes, by agenda kind. Reads `PilotClaim` rather than adding a telemetry
 * write: a claim already brackets exactly the work of one cycle (`grantedAt` to `releasedAt`) and
 * already carries the kind. Wall clock is a proxy for token spend, not a measure of it, but it is
 * the honest one available without parsing provider-specific session files.
 */
export async function costByKind(
  prisma: Pick<PrismaClient, "pilotClaim">,
  userId: string,
  now: Date,
): Promise<PilotKindCost[]> {
  const rows = await prisma.pilotClaim.findMany({
    where: {
      userId,
      releasedAt: { not: null },
      grantedAt: { gte: new Date(now.getTime() - COST_WINDOW_MS) },
    },
    // No row cap: a busy pilot cycles every ACTIVE_SLEEP_SECONDS, so any cap short enough to
    // matter would silently shorten the week the card says it is reporting.
    select: { kind: true, grantedAt: true, releasedAt: true, outcome: true },
  });

  const byKind = new Map<string, { durations: number[]; outcomes: (string | null)[] }>();
  for (const row of rows) {
    if (!row.releasedAt) continue;
    let bucket = byKind.get(row.kind);
    if (!bucket) {
      bucket = { durations: [], outcomes: [] };
      byKind.set(row.kind, bucket);
    }
    bucket.durations.push(row.releasedAt.getTime() - row.grantedAt.getTime());
    bucket.outcomes.push(row.outcome);
  }

  return [...byKind]
    .map(([kind, bucket]) => summarize(kind, bucket.durations, bucket.outcomes))
    .sort((a, b) => b.totalMs - a.totalMs);
}
