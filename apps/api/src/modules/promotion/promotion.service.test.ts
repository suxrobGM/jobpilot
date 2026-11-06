import type { PrismaClient } from "@/generated/prisma/client";
import type { WebPushService } from "@/modules/web-push/web-push.service";
import type { PilotJournalService } from "../pilot/thread/journal.service";
import { PromotionService } from "./promotion.service";
import { describe, expect, it } from "bun:test";

type Row = Record<string, unknown>;

/** Prisma leaves `undefined` fields untouched, so the fake drops them too. */
const defined = (data: Row) =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

function makeService(over: Row = {}) {
  const journals: Row[] = [];
  const post: Row = {
    id: "promo-1",
    userId: "p1",
    platform: "linkedin",
    target: null,
    title: "Shipped a thing",
    body: "Original body",
    status: "draft",
    postedUrl: null,
    scheduledFor: null,
    postedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
  const db = {
    promotionPost: {
      findFirst: async () => post,
      update: async (a: { data: Row }) => ({ ...post, ...defined(a.data) }),
      updateManyAndReturn: async (a: { where: { status: string }; data: Row }) => {
        if (post.status !== a.where.status) return [];
        Object.assign(post, defined(a.data));
        return [post];
      },
    },
  };
  const push = { sendToUser: async () => {} } as unknown as WebPushService;
  const journal = {
    appendJournal: async (_userId: string, body: { entries: Row[] }) => {
      journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
  return {
    svc: new PromotionService(db as unknown as PrismaClient, push, journal),
    journals,
    post,
  };
}

describe("PromotionService.patchPromotion", () => {
  it("journals a decline with the declined draft", async () => {
    const { svc, journals } = makeService();
    await svc.patchPromotion("p1", "promo-1", { status: "declined" });
    expect(journals).toEqual([
      {
        kind: "correction",
        subjectType: "promotion",
        subjectId: "promo-1",
        summary: "Declined linkedin post draft.",
        detail: {
          type: "promotion.declined",
          platform: "linkedin",
          title: "Shipped a thing",
          body: "Original body",
        },
      },
    ]);
  });

  it("journals an edit with the draft before and after", async () => {
    const { svc, journals } = makeService();
    await svc.patchPromotion("p1", "promo-1", { body: "Revised body" });
    expect(journals[0]?.detail).toEqual({
      type: "promotion.edited",
      platform: "linkedin",
      before: { title: "Shipped a thing", body: "Original body" },
      after: { title: "Shipped a thing", body: "Revised body" },
    });
  });

  it("journals nothing for a plain approval", async () => {
    const { svc, journals } = makeService();
    await svc.patchPromotion("p1", "promo-1", { status: "approved" });
    expect(journals).toEqual([]);
  });
});

describe("PromotionService.recordPromotionResult", () => {
  const postedUrl = "https://linkedin.com/feed/update/1";

  it("records a post for an approved draft", async () => {
    const { svc } = makeService({ status: "approved" });
    const result = await svc.recordPromotionResult("p1", "promo-1", {
      outcome: "posted",
      postedUrl,
    });
    expect(result).toMatchObject({ status: "posted", postedUrl, postedAt: expect.any(Date) });
  });

  it("refuses a draft that was never approved, or a second different outcome", async () => {
    const draft = makeService();
    await expect(
      draft.svc.recordPromotionResult("p1", "promo-1", { outcome: "posted" }),
    ).rejects.toThrow("not approved");
    expect(draft.post).toMatchObject({ status: "draft", postedAt: null });

    const posted = makeService({ status: "posted", postedUrl });
    await expect(
      posted.svc.recordPromotionResult("p1", "promo-1", { outcome: "failed" }),
    ).rejects.toThrow("already finished");
    expect(posted.post).toMatchObject({ status: "posted", postedUrl });
  });

  it("returns a repeated outcome as it was", async () => {
    const { svc } = makeService({ status: "posted", postedUrl });
    expect(await svc.recordPromotionResult("p1", "promo-1", { outcome: "posted" })).toMatchObject({
      status: "posted",
      postedUrl,
    });
  });
});
