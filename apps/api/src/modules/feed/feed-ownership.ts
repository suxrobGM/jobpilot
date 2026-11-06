import { findOwned } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

/** A function rather than a service method, so the job and networking services need not inject one. */
export async function ensureFeedOwned(
  prisma: PrismaClient,
  userId: string,
  feedId: string,
): Promise<void> {
  await findOwned(
    (where) => prisma.feed.findFirst({ where, select: { id: true } }),
    { id: feedId, userId },
    "Feed",
  );
}
