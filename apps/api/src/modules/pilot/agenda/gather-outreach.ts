import type { PilotMandateConfig } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  AgendaFollowup,
  AgendaOutreachSend,
  AgendaPromoPost,
  AgendaPromoVenue,
} from "./types";

/** Approved email drafts with a deliverable address, oldest first. LinkedIn drafts are never sends. */
export async function gatherApprovedOutreach(
  prisma: PrismaClient,
  profileId: string,
): Promise<AgendaOutreachSend[]> {
  const rows = await prisma.outreachMessage.findMany({
    where: { profileId, channel: "email", status: "approved", contact: { email: { not: null } } },
    orderBy: { createdAt: "asc" },
    include: { contact: { select: { id: true, name: true, email: true } } },
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
  config: PilotMandateConfig,
  now: Date,
): Promise<AgendaFollowup[]> {
  const cutoff = new Date(now.getTime() - config.outreachFollowupDays * DAY_MS);
  const candidates = await prisma.outreachMessage.findMany({
    where: { profileId, channel: "email", repliedAt: null, sentAt: { not: null, lt: cutoff } },
    orderBy: { sentAt: "asc" },
    include: { contact: { select: { id: true, name: true, email: true } } },
  });
  if (candidates.length === 0) return [];

  // "No later message" = the candidate is still the newest message on its contact.
  const contactIds = [...new Set(candidates.map((c) => c.contactId))];
  const latest = await prisma.outreachMessage.groupBy({
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
    venue: p.venue,
    target: p.target,
    title: p.title,
    body: p.body,
  }));
}

/** Venues whose newest non-declined post is older than their cadence (or which have none yet). */
export async function dueVenues(
  prisma: PrismaClient,
  profileId: string,
  config: PilotMandateConfig,
  now: Date,
): Promise<AgendaPromoVenue[]> {
  const venues = config.promotion.venues;
  if (venues.length === 0) return [];
  const posts = await prisma.promotionPost.findMany({
    where: { profileId, status: { not: "declined" } },
    orderBy: { createdAt: "desc" },
    select: { venue: true, createdAt: true },
  });
  const newestByVenue = new Map<string, Date>();
  for (const p of posts) {
    if (!newestByVenue.has(p.venue)) newestByVenue.set(p.venue, p.createdAt);
  }
  const due: AgendaPromoVenue[] = [];
  for (const v of venues) {
    const newest = newestByVenue.get(v.venue);
    const isDue = !newest || now.getTime() - newest.getTime() >= v.cadenceDays * DAY_MS;
    if (isDue) due.push({ venue: v.venue, target: v.target });
  }
  return due;
}
