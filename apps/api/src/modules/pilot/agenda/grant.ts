import { conflict } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

interface GrantGate {
  /** True when the backing row is still in a leasable state; false triggers the 409 below. */
  verify(prisma: PrismaClient, userId: string, subjectId: string): Promise<boolean>;
  message: string;
}

/**
 * Grant gates for kinds whose leasability depends on a mutable row state the agent must not be
 * trusted to assert (a promo.post/networking.send lease requires the row still `approved`, a
 * campaign.scorePending lease requires an in-progress campaign with unscored rows). Config-derived
 * kinds (e.g. strategy.bootstrap) have no entry here and fall through as leasable.
 */
const GRANT_GATES: Record<string, GrantGate> = {
  "promo.post": {
    verify: async (prisma, userId, subjectId) =>
      (await prisma.promotionPost.findFirst({
        where: { id: subjectId, userId, status: "approved" },
        select: { id: true },
      })) != null,
    message: "Promotion post is no longer approved.",
  },
  "networking.send": {
    verify: async (prisma, userId, subjectId) =>
      (await prisma.networkingMessage.findFirst({
        where: { id: subjectId, userId, status: "approved" },
        select: { id: true },
      })) != null,
    message: "Networking message is no longer approved.",
  },
  "campaign.scorePending": {
    // Only leasable while the campaign is still in progress AND has at least one unscored pending row.
    verify: async (prisma, userId, subjectId) =>
      (await prisma.campaign.findFirst({
        where: {
          campaignId: subjectId,
          userId,
          status: "in_progress",
          jobs: { some: { status: "pending", matchScore: null } },
        },
        select: { campaignId: true },
      })) != null,
    message: "Campaign has no unscored jobs to score.",
  },
};

export async function verifyGrant(
  prisma: PrismaClient,
  userId: string,
  kind: string,
  subjectId: string,
): Promise<void> {
  const gate = GRANT_GATES[kind];
  if (!gate) return;
  if (!(await gate.verify(prisma, userId, subjectId))) throw conflict(gate.message);
}
