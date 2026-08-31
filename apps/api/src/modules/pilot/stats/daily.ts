import { startOfDay } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";

/** Applications for the profile since UTC midnight - the daily apply budget's numerator. */
export function countAppliedToday(
  prisma: Pick<PrismaClient, "application">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.application.count({
    where: { userId, appliedAt: { gte: startOfDay(now) } },
  });
}

/** Networking messages sent for the profile since UTC midnight - the daily networking cap's numerator. */
export function countSentToday(
  prisma: Pick<PrismaClient, "networkingMessage">,
  userId: string,
  now: Date,
): Promise<number> {
  return prisma.networkingMessage.count({
    where: { userId, sentAt: { gte: startOfDay(now) } },
  });
}
