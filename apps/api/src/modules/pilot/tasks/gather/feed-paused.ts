import type { FeedKind } from "@/generated/prisma/client";
import type { GatherContext } from "./gather-context";

/** A paused feed drops out of the pilot's gathering. */
export async function isFeedPaused(ctx: GatherContext, kind: FeedKind): Promise<boolean> {
  const { prisma, userId } = ctx;
  const paused = await prisma.feed.count({ where: { userId, kind, pausedAt: { not: null } } });
  return paused > 0;
}
