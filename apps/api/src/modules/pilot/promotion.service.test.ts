// Fake-Prisma unit test for PromotionService correction capture: a user declining or editing a
// draft post is recorded as a labeled "correction" journal entry (before/after in detail).
// Injects fakes directly (no database); publish() is a no-op without subscribers.

import type { PushPayload, PushService } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PilotService } from "./pilot.service";
import { PromotionService } from "./promotion.service";
import { describe, expect, it } from "bun:test";

/** Strip `undefined` values so the fake update mirrors Prisma's skip-undefined semantics. */
function defined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

const basePost = {
  id: "promo-1",
  profileId: "p1",
  venue: "linkedin",
  target: null,
  title: "Shipped a thing",
  body: "Original body",
  status: "draft",
  postedUrl: null,
  scheduledFor: null,
  postedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDeps(over: Record<string, unknown> = {}) {
  const journals: Record<string, unknown>[] = [];
  const existing = { ...basePost, ...over };
  const db = {
    promotionPost: {
      findFirst: async () => existing,
      // Prisma leaves `undefined` fields untouched; mirror that so unchanged columns survive.
      update: async (a: { data: Record<string, unknown> }) => ({ ...existing, ...defined(a.data) }),
    },
  };
  const push = {
    sendToProfile: async (_p: string, _payload: PushPayload) => {},
  } as unknown as PushService;
  const pilot = {
    appendJournal: async (_p: string, body: { entries: Record<string, unknown>[] }) => {
      journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotService;
  const svc = new PromotionService(db as unknown as PrismaClient, push, pilot);
  return { svc, journals };
}

describe("PromotionService correction capture", () => {
  it("logs a decline correction with the declined draft's content", async () => {
    const { svc, journals } = makeDeps();
    await svc.patchPromotion("p1", "promo-1", { status: "declined" });

    expect(journals).toHaveLength(1);
    expect(journals[0]).toMatchObject({
      kind: "correction",
      summary: "Declined linkedin post draft.",
      subjectType: "promotion",
      subjectId: "promo-1",
      detail: {
        type: "promotion.declined",
        venue: "linkedin",
        title: "Shipped a thing",
        body: "Original body",
      },
    });
  });

  it("logs an edit correction capturing before and after", async () => {
    const { svc, journals } = makeDeps();
    await svc.patchPromotion("p1", "promo-1", { body: "Revised body" });

    expect(journals).toHaveLength(1);
    expect(journals[0]).toMatchObject({
      kind: "correction",
      subjectType: "promotion",
      subjectId: "promo-1",
      detail: {
        type: "promotion.edited",
        venue: "linkedin",
        before: { title: "Shipped a thing", body: "Original body" },
        after: { title: "Shipped a thing", body: "Revised body" },
      },
    });
  });

  it("logs nothing when a draft is approved without content changes", async () => {
    const { svc, journals } = makeDeps();
    await svc.patchPromotion("p1", "promo-1", { status: "approved" });

    expect(journals).toHaveLength(0);
  });
});
