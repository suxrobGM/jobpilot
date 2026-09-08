import type { PrismaClient } from "@/generated/prisma/client";
import { verifyGrant } from "./grant";
import { describe, expect, it } from "bun:test";

type GrantClient = Pick<PrismaClient, "promotionPost" | "networkingMessage" | "campaign">;

const client = (campaignRow: Record<string, unknown> | null): GrantClient =>
  ({
    campaign: { findFirst: async () => campaignRow },
    promotionPost: { findFirst: async () => null },
    networkingMessage: { findFirst: async () => null },
  }) as unknown as GrantClient;

describe("verifyGrant campaign.reviewPaused", () => {
  it("grants while the campaign is still paused", async () => {
    await expect(
      verifyGrant(client({ campaignId: "c9" }), "u1", "campaign.reviewPaused", "c9"),
    ).resolves.toBeUndefined();
  });

  it("409s once the campaign left the paused state (user resumed/completed it)", async () => {
    await expect(verifyGrant(client(null), "u1", "campaign.reviewPaused", "c9")).rejects.toThrow(
      "Campaign is no longer paused.",
    );
  });
});
