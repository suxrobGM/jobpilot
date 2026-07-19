import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP } from "./constants";
import type {
  AgendaFollowup,
  AgendaNetworkingSend,
  AgendaPromoPlatform,
  AgendaPromoPost,
} from "./types";

/** Approved email drafts with a deliverable address, oldest first. LinkedIn drafts are never sends. */
export async function gatherApprovedNetworking(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaNetworkingSend[]> {
  const rows = await prisma.networkingMessage.findMany({
    where: { profileId, channel: "email", status: "approved", contact: { email: { not: null } } },
    orderBy: { createdAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      campaignId: true,
      contactId: true,
      subject: true,
      body: true,
      contact: { select: { name: true, email: true } },
    },
  });
  return rows.map((m) => ({
    campaignId: m.campaignId ?? "",
    messageId: m.id,
    contactId: m.contactId,
    contactName: m.contact.name,
    contactEmail: m.contact.email ?? "",
    subject: m.subject,
    body: m.body,
  }));
}

/** Sent emails past the followup window with no reply and no later message to the same contact. */
export async function gatherFollowups(
  prisma: PrismaClient,
  profileId: string,
  config: PilotInstructionsConfig,
  now: Date,
): Promise<AgendaFollowup[]> {
  const cutoff = new Date(now.getTime() - config.networkingFollowupDays * DAY_MS);
  const candidates = await prisma.networkingMessage.findMany({
    where: { profileId, channel: "email", repliedAt: null, sentAt: { not: null, lt: cutoff } },
    orderBy: { sentAt: "asc" },
    take: GATHER_CAP,
    select: {
      id: true,
      campaignId: true,
      contactId: true,
      subject: true,
      sentAt: true,
      createdAt: true,
      contact: { select: { name: true, email: true } },
    },
  });
  if (candidates.length === 0) return [];

  // "No later message" = the candidate is still the newest message on its contact.
  const contactIds = [...new Set(candidates.map((c) => c.contactId))];
  const latest = await prisma.networkingMessage.groupBy({
    by: ["contactId"],
    where: { contactId: { in: contactIds } },
    _max: { createdAt: true },
  });
  const latestByContact = new Map(latest.map((l) => [l.contactId, l._max.createdAt]));

  return candidates
    .filter((c) => latestByContact.get(c.contactId)?.getTime() === c.createdAt.getTime())
    .map((c) => ({
      campaignId: c.campaignId ?? "",
      messageId: c.id,
      contactId: c.contactId,
      contactName: c.contact.name,
      contactEmail: c.contact.email ?? "",
      subject: c.subject,
      sentAt: c.sentAt as Date,
      daysSince: Math.floor((now.getTime() - (c.sentAt as Date).getTime()) / DAY_MS),
    }));
}

/** Approved posts whose schedule (if any) has arrived. */
export async function gatherApprovedPromotions(
  prisma: PrismaClient,
  profileId: string,
  now: Date,
): Promise<AgendaPromoPost[]> {
  const rows = await prisma.promotionPost.findMany({
    where: {
      profileId,
      status: "approved",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    platform: p.platform,
    target: p.target,
    title: p.title,
    body: p.body,
  }));
}

/** Platforms whose newest non-declined post is older than their cadence (or which have none yet). */
export async function duePlatforms(
  prisma: PrismaClient,
  profileId: string,
  config: PilotInstructionsConfig,
  now: Date,
): Promise<AgendaPromoPlatform[]> {
  const platforms = config.promotion.platforms;
  if (platforms.length === 0) return [];
  const posts = await prisma.promotionPost.findMany({
    where: {
      profileId,
      status: { not: "declined" },
      platform: { in: platforms.map((p) => p.platform) },
    },
    orderBy: { createdAt: "desc" },
    take: GATHER_CAP,
    select: { platform: true, createdAt: true },
  });
  const newestByPlatform = new Map<string, Date>();
  for (const p of posts) {
    if (!newestByPlatform.has(p.platform)) newestByPlatform.set(p.platform, p.createdAt);
  }
  const due: AgendaPromoPlatform[] = [];
  for (const p of platforms) {
    const newest = newestByPlatform.get(p.platform);
    const isDue = !newest || now.getTime() - newest.getTime() >= p.cadenceDays * DAY_MS;
    if (isDue) due.push({ platform: p.platform, target: p.target });
  }
  return due;
}
