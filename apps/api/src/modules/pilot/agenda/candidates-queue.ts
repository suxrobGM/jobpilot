import type { PrismaClient } from "@/generated/prisma/client";
import { QUEUE_BATCH } from "./constants";
import type { AgendaQueueDrain } from "./types";

/** Returns the bounded oldest-first queue drain batch and total pending count. */
export async function gatherQueueDrain(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaQueueDrain> {
  const where = { userId, status: "pending" } as const;
  const [entries, pendingCount] = await Promise.all([
    prisma.queueEntry.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: QUEUE_BATCH,
      select: { id: true, url: true },
    }),
    prisma.queueEntry.count({ where }),
  ]);
  return { entries, pendingCount };
}
