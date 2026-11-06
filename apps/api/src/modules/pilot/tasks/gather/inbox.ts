import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { latestRun, ranRecently } from "../../runs/run-history";

const INBOX_BATCH = 10;
const UPWORK_SYNC_STALE_MS = 6 * HOUR_MS;

/** The oldest unclassified mail, plus how much is waiting in total. */
export async function gatherInbox(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"inbox.review">> {
  const where = { account: { userId }, classification: null, reviewStatus: "pending" } as const;
  const [rows, count] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: INBOX_BATCH,
      select: { id: true },
    }),
    prisma.emailMessage.count({ where }),
  ]);
  return { messageIds: rows.map((row) => row.id), count };
}

/**
 * A stale Upwork mirror, or none yet. Only for users with Upwork rows: nothing here can tell whether
 * the MCP is connected, so the run damper is what stops "not connected" repeating every cycle.
 */
export async function gatherUpworkSync(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"upwork.syncInbox"> | null> {
  const [account, profileCount] = await Promise.all([
    prisma.upworkAccount.findUnique({ where: { userId }, select: { lastSyncedAt: true } }),
    prisma.upworkProfile.count({ where: { userId } }),
  ]);
  if (!account && profileCount === 0) return null;

  const lastSyncedAt = account?.lastSyncedAt ?? null;
  const fresh = lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < UPWORK_SYNC_STALE_MS;
  if (fresh) return null;
  const lastRun = await latestRun(prisma, userId, "upwork.syncInbox");
  if (ranRecently(lastRun, now, UPWORK_SYNC_STALE_MS)) return null;

  const unreadCount = await prisma.upworkInboxItem.count({ where: { userId, status: "unread" } });
  return { lastSyncedAt, unreadCount };
}
