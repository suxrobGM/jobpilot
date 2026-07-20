import { conflict } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Grant gate for kinds whose leasability depends on a mutable row state the agent must
 * not be trusted to assert: a promo.post lease requires the post to still be `approved`,
 * a networking.send lease requires the message to still be `approved`. 409 otherwise.
 * Config-derived kinds (e.g. strategy.bootstrap) have no row to verify and fall through.
 */
export async function verifyGrant(
  prisma: PrismaClient,
  userId: string,
  kind: string,
  subjectId: string,
): Promise<void> {
  if (kind === "promo.post") {
    const post = await prisma.promotionPost.findFirst({
      where: { id: subjectId, userId, status: "approved" },
      select: { id: true },
    });
    if (!post) throw conflict("Promotion post is no longer approved.");
    return;
  }
  if (kind === "networking.send") {
    const message = await prisma.networkingMessage.findFirst({
      where: { id: subjectId, userId, status: "approved" },
      select: { id: true },
    });
    if (!message) throw conflict("Networking message is no longer approved.");
    return;
  }
  if (kind === "campaign.scorePending") {
    // Only leasable while the campaign is still in progress AND has at least one unscored pending row.
    const campaign = await prisma.campaign.findFirst({
      where: {
        campaignId: subjectId,
        userId,
        status: "in_progress",
        jobs: { some: { status: "pending", matchScore: null } },
      },
      select: { campaignId: true },
    });
    if (!campaign) throw conflict("Campaign has no unscored jobs to score.");
  }
}
