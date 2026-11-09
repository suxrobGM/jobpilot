import type { PrismaClient } from "@/generated/prisma/client";
import { NetworkingService } from "./networking.service";
import { describe, expect, it } from "bun:test";

interface Over {
  message: Record<string, unknown>;
}

function makeDb(over: Over, networkingWrites: Record<string, unknown>[]) {
  const contact = {
    id: "ct1",
    userId: "p1",
    name: "Dana",
    title: null,
    company: "Acme",
    linkedinUrl: null,
    email: "dana@acme.test",
    emailSource: null,
    emailConfidence: null,
    linkedinConnection: "none",
    discoverySource: null,
    matchConfidence: null,
    applicationId: null,
    jobUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const base = {
    id: "m1",
    userId: "p1",
    contactId: "ct1",
    feedId: "c1",
    linkedinKind: null,
    subject: "Hi",
    body: "hello",
    failReason: null,
    providerId: null,
    threadId: null,
    sentAt: null,
    repliedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let current = { ...base, ...over.message };

  const db = {
    networkingMessage: {
      findFirst: async () => ({
        ...current,
        contact,
        feed: { source: "networking" },
      }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        networkingWrites.push(data);
        current = {
          ...current,
          ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
        };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...current, contact }),
      // Prisma leaves `undefined` fields untouched; mirror that so unchanged columns survive.
      update: async (a: { data: Record<string, unknown> }) => {
        current = {
          ...current,
          ...Object.fromEntries(Object.entries(a.data).filter(([, value]) => value !== undefined)),
        };
        return { ...current, contact };
      },
      groupBy: async () => [],
      findMany: async () => [],
    },
    feed: { update: async () => ({}) },
    pilotState: { upsert: async () => ({}) },
    $queryRaw: async () => [],
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return db;
}

const service = (over: Over) => {
  const networkingWrites: Record<string, unknown>[] = [];
  return {
    svc: new NetworkingService(makeDb(over, networkingWrites) as unknown as PrismaClient),
    networkingWrites,
  };
};

describe("networking send gate: LinkedIn InMail", () => {
  it("rejects a sent result for an unapproved InMail", async () => {
    const { svc } = service({
      message: { channel: "linkedin", linkedinKind: "inmail", status: "draft" },
    });
    await expect(
      svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" }),
    ).rejects.toThrow();
  });

  it("allows a sent result once the InMail is approved", async () => {
    const { svc } = service({
      message: { channel: "linkedin", linkedinKind: "inmail", status: "approved" },
    });
    const res = await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    expect(res.message.status).toBe("sent");
  });
});

describe("networking result: sent email", () => {
  // The email already left the outbox by the time the result lands, so recording must never be
  // rejected (a cap 422 here would leave sentAt null and let the task list re-emit → duplicate email).
  it("records a sent email result unconditionally, stamping sentAt", async () => {
    const { svc } = service({
      message: { channel: "email", status: "approved" },
    });
    const res = await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    expect(res.message.status).toBe("sent");
    expect(res.message.sentAt).toBeInstanceOf(Date);
  });

  it("returns an identical terminal result without writing twice", async () => {
    const { svc, networkingWrites } = service({
      message: { channel: "email", status: "approved" },
    });
    await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    const repeated = await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    expect(repeated.message.status).toBe("sent");
    expect(networkingWrites).toHaveLength(1);
  });

  it("rejects a different terminal outcome", async () => {
    const { svc } = service({ message: { channel: "email", status: "approved" } });
    await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    await expect(
      svc.recordNetworkingResult("p1", "c1", "m1", {
        outcome: "failed",
        failReason: "late failure",
      }),
    ).rejects.toThrow("already finished");
  });
});
