// Fake-Prisma unit test for PushService. web-push is stubbed by swapping sendNotification on the
// shared module object (WebPushError stays the real class so `instanceof` still holds), and VAPID is
// injected via the constructor - so this loads with no database and no env.
import webpush from "web-push";
import type { PrismaClient } from "@/generated/prisma/client";
import { PushService, type VapidConfigHolder } from "./push.service";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const VAPID = webpush.generateVAPIDKeys();
const configured: VapidConfigHolder = {
  vapid: {
    publicKey: VAPID.publicKey,
    privateKey: VAPID.privateKey,
    subject: "mailto:test@jobpilot.dev",
  },
};

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

interface UpsertArgs {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

interface Rec {
  upsertArgs?: UpsertArgs;
  deletedIds: string[];
  findFirst: Sub | null;
  findMany: Sub[];
}

function makeDb(overrides: Partial<Rec> = {}) {
  const rec: Rec = { deletedIds: [], findFirst: null, findMany: [], ...overrides };
  const db = {
    pushSubscription: {
      upsert: async (a: UpsertArgs) => {
        rec.upsertArgs = a;
        return { id: "sub-new", endpoint: a.create.endpoint as string, createdAt: new Date() };
      },
      findFirst: async () => (rec.findFirst ? { id: rec.findFirst.id } : null),
      findMany: async () => rec.findMany,
      delete: async (a: { where: { id: string } }) => {
        rec.deletedIds.push(a.where.id);
        return {};
      },
    },
  };
  return { db, rec };
}

const svc = (overrides?: Partial<Rec>, holder: VapidConfigHolder = configured) => {
  const { db, rec } = makeDb(overrides);
  return { push: new PushService(db as unknown as PrismaClient, holder), rec };
};

const realSend = webpush.sendNotification;
afterEach(() => {
  webpush.sendNotification = realSend;
});

describe("PushService config", () => {
  it("reports unconfigured and a null public key when VAPID is absent", () => {
    const { push } = svc({}, { vapid: null });
    expect(push.isConfigured).toBe(false);
    expect(push.publicKey).toBeNull();
  });

  it("exposes the public key when configured", () => {
    const { push } = svc();
    expect(push.isConfigured).toBe(true);
    expect(push.publicKey).toBe(VAPID.publicKey);
  });
});

describe("PushService subscribe", () => {
  it("upserts by endpoint and returns the DTO", async () => {
    const { push, rec } = svc();
    const dto = await push.subscribe("p1", {
      endpoint: "https://push/abc",
      keys: { p256dh: "pub", auth: "sec" },
      userAgent: "Firefox",
    });

    expect(dto).toMatchObject({ id: "sub-new", endpoint: "https://push/abc" });
    expect(rec.upsertArgs?.where).toEqual({ endpoint: "https://push/abc" });
    expect(rec.upsertArgs?.create).toMatchObject({ profileId: "p1", endpoint: "https://push/abc" });
  });

  it("reassigns the endpoint's profileId on conflict (shared device)", async () => {
    const { push, rec } = svc();
    await push.subscribe("p2", {
      endpoint: "https://push/abc",
      keys: { p256dh: "pub", auth: "sec" },
    });

    // The update branch must move an existing endpoint to the new owner.
    expect(rec.upsertArgs?.update).toMatchObject({ profileId: "p2" });
  });
});

describe("PushService unsubscribe", () => {
  it("deletes the owned row and returns its id", async () => {
    const owned: Sub = { id: "sub-1", endpoint: "https://push/abc", p256dh: "pub", auth: "sec" };
    const { push, rec } = svc({ findFirst: owned });
    const id = await push.unsubscribe("p1", "https://push/abc");

    expect(id).toBe("sub-1");
    expect(rec.deletedIds).toEqual(["sub-1"]);
  });

  it("returns null and deletes nothing when the endpoint is not owned", async () => {
    const { push, rec } = svc({ findFirst: null });
    const id = await push.unsubscribe("p1", "https://push/other");

    expect(id).toBeNull();
    expect(rec.deletedIds).toEqual([]);
  });
});

describe("PushService sendToProfile", () => {
  it("sends nothing when unconfigured", async () => {
    const send = mock(async () => ({}) as never);
    webpush.sendNotification = send as unknown as typeof webpush.sendNotification;
    const { push } = svc(
      { findMany: [{ id: "s1", endpoint: "e1", p256dh: "pub", auth: "sec" }] },
      { vapid: null },
    );

    await push.sendToProfile("p1", { title: "t", body: "b" });
    expect(send).not.toHaveBeenCalled();
  });

  it("delivers to every subscription and prunes ones the push service reports gone (410)", async () => {
    const subs: Sub[] = [
      { id: "live", endpoint: "https://push/live", p256dh: "pub", auth: "sec" },
      { id: "dead", endpoint: "https://push/dead", p256dh: "pub", auth: "sec" },
    ];
    webpush.sendNotification = (async (sub: { endpoint: string }) => {
      if (sub.endpoint === "https://push/dead") {
        throw new webpush.WebPushError("gone", 410, {} as never, "", sub.endpoint);
      }
      return {} as never;
    }) as unknown as typeof webpush.sendNotification;

    const { push, rec } = svc({ findMany: subs });
    await push.sendToProfile("p1", { title: "t", body: "b", url: "/pilot" });

    expect(rec.deletedIds).toEqual(["dead"]);
  });

  it("truncates a long body to 120 chars ending in an ellipsis", async () => {
    let sentBody = "";
    webpush.sendNotification = (async (_sub: unknown, body: string) => {
      sentBody = body;
      return {} as never;
    }) as unknown as typeof webpush.sendNotification;

    const { push } = svc({
      findMany: [{ id: "s1", endpoint: "https://push/x", p256dh: "pub", auth: "sec" }],
    });
    await push.sendToProfile("p1", { title: "t", body: "x".repeat(200) });

    const payload = JSON.parse(sentBody) as { body: string };
    expect(payload.body.length).toBe(120);
    expect(payload.body.endsWith("…")).toBe(true);
  });

  it("logs and does not prune on a non-gone error", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    webpush.sendNotification = (async () => {
      throw new webpush.WebPushError("boom", 500, {} as never, "", "https://push/x");
    }) as unknown as typeof webpush.sendNotification;

    const { push, rec } = svc({
      findMany: [{ id: "s1", endpoint: "https://push/x", p256dh: "pub", auth: "sec" }],
    });
    await push.sendToProfile("p1", { title: "t", body: "b" });

    expect(rec.deletedIds).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
