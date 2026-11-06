import { workspaceChannel } from "@jobpilot/contracts/sse";
import { findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

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

export function publishFeedUpdated(userId: string, feedId: string): void {
  publish(workspaceChannel, { userId }, { type: "feed.updated", feedId });
}

/** Pasted links as `queued` rows; nothing is known about a link until a worker opens it. */
export function queuedJobRows(
  userId: string,
  feedId: string,
  urls: string[],
): Prisma.JobCreateManyInput[] {
  return urls.map((url) => ({
    userId,
    feedId,
    key: crypto.randomUUID(),
    // The host stands in for the title until the score pass reads the posting.
    title: new URL(url).hostname,
    company: "",
    url,
    status: "queued",
  }));
}
