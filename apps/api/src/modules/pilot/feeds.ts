import type { CampaignFeed, PrismaClient } from "@/generated/prisma/client";
import { publishCampaignStatus } from "@/modules/campaign/campaign.utils";

/** Pausing a feed's standing campaign pauses the feed. */
export async function isFeedPaused(
  prisma: PrismaClient,
  userId: string,
  feed: CampaignFeed,
): Promise<boolean> {
  const paused = await prisma.campaign.count({ where: { userId, feed, status: "paused" } });
  return paused > 0;
}

/** Run now on a paused feed is the user resuming it. */
export async function resumePausedFeed(
  prisma: PrismaClient,
  userId: string,
  feed: CampaignFeed,
): Promise<void> {
  const resumed = await prisma.campaign.updateManyAndReturn({
    where: { userId, feed, status: "paused" },
    data: { status: "in_progress", statusChangedBy: "user", statusReason: "Run now" },
    select: { id: true, source: true },
  });
  for (const campaign of resumed) publishCampaignStatus(userId, campaign, "in_progress");
}
