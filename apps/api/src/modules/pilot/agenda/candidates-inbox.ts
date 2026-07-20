import type { PrismaClient } from "@/generated/prisma/client";
import { INBOX_BATCH } from "./constants";
import type { AgendaInbox } from "./types";

/** Returns the bounded oldest-first inbox review batch and total pending count. */
export async function gatherInbox(prisma: PrismaClient, userId: string): Promise<AgendaInbox> {
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
