import { findOwned } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

/** Throws 404 unless `campaignId` belongs to `profileId`. Shared by the core,
 * job, and outreach services so none has to inject another. */
export async function ensureCampaignOwned(
  prisma: PrismaClient,
  profileId: string,
  campaignId: string,
): Promise<void> {
  await findOwned(
    (where) => prisma.campaign.findFirst({ where, select: { campaignId: true } }),
    { campaignId, profileId },
    "Campaign",
  );
}
