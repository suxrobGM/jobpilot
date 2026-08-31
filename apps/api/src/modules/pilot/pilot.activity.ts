import { pilotCycleDetailSchema } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Newest persisted activity, so the terminal can tell a slow live cycle from a stuck one.
 * One read for the (few) unreleased claims covers both the newest claim timestamp and the count.
 */
export async function readPilotActivity(prisma: PrismaClient, userId: string) {
  const [claims, journalAgg, campaignAgg, jobAgg, cycleEntry, state] = await Promise.all([
    prisma.pilotClaim.findMany({
      where: { userId, releasedAt: null },
      select: { grantedAt: true, heartbeatAt: true, expiresAt: true },
    }),
    prisma.pilotJournalEntry.aggregate({ where: { userId }, _max: { createdAt: true } }),
    prisma.campaign.aggregate({ where: { userId }, _max: { updatedAt: true } }),
    prisma.job.aggregate({ where: { campaign: { userId } }, _max: { updatedAt: true } }),
    prisma.pilotJournalEntry.findFirst({
      where: { userId, kind: "cycle" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { cycleId: true, createdAt: true, detail: true },
    }),
    prisma.pilotState.findUnique({ where: { userId }, select: { running: true } }),
  ]);

  const times = [
    ...claims.flatMap((c) => [c.grantedAt, c.heartbeatAt]),
    journalAgg._max.createdAt,
    campaignAgg._max.updatedAt,
    jobAgg._max.updatedAt,
  ];

  // Expired-but-unswept claims still count toward lastActivityAt but not as "active".
  const now = new Date();
  return {
    lastActivityAt: times.reduce<Date | null>(
      (max, d) => (d != null && (max == null || d > max) ? d : max),
      null,
    ),
    activeClaims: claims.filter((c) => c.expiresAt > now).length,
    // No row yet means the pilot was never started, so the host's gate must read it as stopped.
    running: state?.running ?? false,
    lastCycle: toLastCycle(cycleEntry),
  };
}

/**
 * Stall-recovery cycles routinely land with `detail: {}`, so missing fields null out here rather
 * than throwing - the host still needs `completedAt` off such an entry.
 */
function toLastCycle(entry: { cycleId: string | null; createdAt: Date; detail: unknown } | null) {
  if (!entry) return null;
  const detail = pilotCycleDetailSchema.safeParse(entry.detail).data;
  return {
    cycleId: entry.cycleId,
    completedAt: entry.createdAt,
    status: detail?.status ?? null,
    sleepSeconds: detail?.sleepSeconds ?? null,
  };
}
