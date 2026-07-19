import type { PrismaClient } from "@/generated/prisma/client";
import { startOfDayInTz } from "./pilot.time";

/** Applications for the profile since the start of its tz-local day - the daily apply budget's numerator. */
export function countAppliedToday(
  prisma: Pick<PrismaClient, "application">,
  profileId: string,
  now: Date,
  tz?: string,
): Promise<number> {
  return prisma.application.count({
    where: { profileId, appliedAt: { gte: startOfDayInTz(now, tz) } },
  });
}

/** Networking messages sent for the profile since the start of its tz-local day - the daily networking cap's numerator. */
export function countSentToday(
  prisma: Pick<PrismaClient, "networkingMessage">,
  profileId: string,
  now: Date,
  tz?: string,
): Promise<number> {
  return prisma.networkingMessage.count({
    where: { profileId, sentAt: { gte: startOfDayInTz(now, tz) } },
  });
}
