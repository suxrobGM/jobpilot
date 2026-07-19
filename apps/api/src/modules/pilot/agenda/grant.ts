import { conflict } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Grant gate for kinds whose leasability depends on a mutable row state the agent must
 * not be trusted to assert: a promo.post lease requires the post to still be `approved`,
 * a networking.send lease requires the message to still be `approved`. 409 otherwise.
 */
export async function verifyGrant(
  prisma: PrismaClient,
  profileId: string,
  kind: string,
  subjectId: string,
): Promise<void> {
  if (kind === "promo.post") {
    const post = await prisma.promotionPost.findFirst({
      where: { id: subjectId, profileId, status: "approved" },
      select: { id: true },
    });
    if (!post) throw conflict("Promotion post is no longer approved.");
    return;
  }
  if (kind === "networking.send") {
    const message = await prisma.networkingMessage.findFirst({
      where: { id: subjectId, profileId, status: "approved" },
      select: { id: true },
    });
    if (!message) throw conflict("Networking message is no longer approved.");
  }
}
