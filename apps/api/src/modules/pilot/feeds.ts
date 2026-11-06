import type { PilotConfig } from "@jobpilot/contracts/pilot";
import type { CampaignFeed, PrismaClient } from "@/generated/prisma/client";

/** Feeds whose standing campaign stays open while idle. */
export function liveFeeds(config: PilotConfig, goals: string): CampaignFeed[] {
  const feeds: CampaignFeed[] = [];
  if (config.jobAlerts.enabled) feeds.push("job_alerts");
  if (goals !== "") feeds.push("research");
  return feeds;
}

/** Pausing a feed's standing campaign pauses the feed. */
export async function isFeedPaused(
  prisma: PrismaClient,
  userId: string,
  feed: CampaignFeed,
): Promise<boolean> {
  const paused = await prisma.campaign.count({ where: { userId, feed, status: "paused" } });
  return paused > 0;
}
