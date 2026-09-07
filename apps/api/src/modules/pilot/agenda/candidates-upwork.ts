import type { PrismaClient } from "@/generated/prisma/client";
import { UPWORK_SYNC_STALE_MS } from "./constants";
import { claimDamped } from "./gather-jobs";
import type { AgendaUpworkSync } from "./types";

/**
 * A stale Upwork mirror, or none at all. Gated on the user already having Upwork rows: nothing here
 * can tell whether they connected the MCP, and an unconnected account only journals "not connected",
 * so the recent-claim damper is what stops that from repeating every cycle.
 */
export async function gatherUpworkSync(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<AgendaUpworkSync | null> {
  const [account, profileCount] = await Promise.all([
    prisma.upworkAccount.findUnique({ where: { userId }, select: { lastSyncedAt: true } }),
    prisma.upworkProfile.count({ where: { userId } }),
  ]);

  if (!account && profileCount === 0) {
    return null;
  }

  const lastSyncedAt = account?.lastSyncedAt ?? null;
  if (lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < UPWORK_SYNC_STALE_MS) {
    return null;
  }

  const lastClaim = await prisma.pilotClaim.findFirst({
    where: { userId, kind: "upwork.syncInbox" },
    orderBy: { grantedAt: "desc" },
    select: { grantedAt: true, releasedAt: true, outcome: true },
  });
  if (claimDamped(lastClaim ?? undefined, now, UPWORK_SYNC_STALE_MS)) {
    return null;
  }

  const unreadCount = await prisma.upworkInboxItem.count({ where: { userId, status: "unread" } });
  return { lastSyncedAt, unreadCount };
}
