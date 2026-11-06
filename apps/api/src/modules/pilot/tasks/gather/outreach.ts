import type { PilotConfig, TaskPayload } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP } from "../../runs/run-history";
import { networkingSendWhere, promotionPostWhere } from "./workable";

/** The build step adds the channel and mode, which come from config rather than the row. */
export type Followup = Omit<TaskPayload<"networking.followup">, "channel" | "autonomy">;

// The where-clauses below guarantee a feed and a contact email; the flatMaps convince the types.

/** Sendable drafts, oldest first. */
export async function gatherApprovedNetworking(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"networking.send">[]> {
  const rows = await prisma.networkingMessage.findMany({
    where: networkingSendWhere(userId),
    orderBy: { createdAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      feedId: true,
      contactId: true,
      subject: true,
      body: true,
      contact: { select: { name: true, email: true } },
    },
  });
  return rows.flatMap(({ id, feedId, contact, ...message }) =>
    feedId && contact.email
      ? [
          {
            ...message,
            feedId,
            messageId: id,
            contactName: contact.name,
            contactEmail: contact.email,
          },
        ]
      : [],
  );
}

/** Sent emails past the followup window with no reply and no later message to the same contact. */
export async function gatherFollowups(
  prisma: PrismaClient,
  userId: string,
  config: PilotConfig,
  now: Date,
): Promise<Followup[]> {
  const rows = await prisma.networkingMessage.findMany({
    where: {
      userId,
      feedId: { not: null },
      channel: "email",
      repliedAt: null,
      sentAt: { not: null, lt: new Date(now.getTime() - config.networking.followupDays * DAY_MS) },
    },
    orderBy: { sentAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      feedId: true,
      contactId: true,
      subject: true,
      sentAt: true,
      createdAt: true,
      contact: { select: { name: true, email: true } },
    },
  });
  if (rows.length === 0) return [];

  const newest = await prisma.networkingMessage.groupBy({
    by: ["contactId"],
    where: { contactId: { in: [...new Set(rows.map((row) => row.contactId))] } },
    _max: { createdAt: true },
  });
  const newestByContact = new Map(newest.map((row) => [row.contactId, row._max.createdAt]));

  return rows.flatMap(({ id, feedId, contactId, subject, sentAt, createdAt, contact }) => {
    const isNewest = newestByContact.get(contactId)?.getTime() === createdAt.getTime();
    if (!isNewest || !feedId || !sentAt || !contact.email) return [];
    return [
      {
        feedId,
        messageId: id,
        contactId,
        contactName: contact.name,
        contactEmail: contact.email,
        subject,
        sentAt,
        daysSince: Math.floor((now.getTime() - sentAt.getTime()) / DAY_MS),
      },
    ];
  });
}

export async function gatherApprovedPromotions(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"promotion.post">[]> {
  const rows = await prisma.promotionPost.findMany({
    where: promotionPostWhere(userId, now),
    orderBy: { createdAt: "asc" },
    select: { id: true, platform: true, target: true, title: true, body: true },
  });
  return rows.map(({ id, ...post }) => ({ ...post, promotionId: id }));
}

/** Platforms whose newest non-declined post is older than their cadence, or which have none yet. */
export async function gatherDuePlatforms(
  prisma: PrismaClient,
  userId: string,
  config: PilotConfig,
  now: Date,
): Promise<TaskPayload<"promotion.draft">[]> {
  const { platforms } = config.promotion;
  if (platforms.length === 0) return [];

  const posts = await prisma.promotionPost.groupBy({
    by: ["platform"],
    where: {
      userId,
      status: { not: "declined" },
      platform: { in: platforms.map((p) => p.platform) },
    },
    _max: { createdAt: true },
  });
  const newestByPlatform = new Map(posts.map((post) => [post.platform, post._max.createdAt]));

  return platforms
    .filter(({ platform, postEveryDays }) => {
      const newest = newestByPlatform.get(platform);
      return !newest || now.getTime() - newest.getTime() >= postEveryDays * DAY_MS;
    })
    .map(({ platform, target }) => ({ platform, target }));
}
