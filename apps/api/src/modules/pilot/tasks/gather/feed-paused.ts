import type { FeedKind, PrismaClient } from "@/generated/prisma/client";

/** A paused feed drops out of the pilot's gathering. */
export async function isFeedPaused(
  prisma: PrismaClient,
  userId: string,
  kind: FeedKind,
): Promise<boolean> {
  const paused = await prisma.feed.count({ where: { userId, kind, pausedAt: { not: null } } });
  return paused > 0;
}
