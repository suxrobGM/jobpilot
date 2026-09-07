import type { PrismaClient } from "@/generated/prisma/client";
import { UPWORK_SYNC_STALE_MS } from "./constants";
import type { AgendaUpworkSync } from "./types";

/**
 * A stale Upwork mirror, or none at all. Gated on the user already having Upwork
 * rows: nothing here can tell whether they connected the MCP, so an untouched
 * account would otherwise be offered a sync it cannot run every cycle.
 */
export async function gatherUpworkSync(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<AgendaUpworkSync | null> {
  const [account, hasUpworkUse, unreadCount] = await Promise.all([
    prisma.upworkAccount.findUnique({ where: { userId }, select: { lastSyncedAt: true } }),
    prisma.upworkProfile.count({ where: { userId } }),
    prisma.upworkInboxItem.count({ where: { userId, status: "unread" } }),
  ]);

  if (!account && hasUpworkUse === 0) {
    return null;
  }

  const lastSyncedAt = account?.lastSyncedAt ?? null;
  if (lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < UPWORK_SYNC_STALE_MS) {
    return null;
  }

  return { lastSyncedAt, unreadCount };
}
