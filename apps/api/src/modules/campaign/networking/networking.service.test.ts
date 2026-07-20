// Fake-Prisma unit test for the networking send gate (InMail requires user approval) and terminal
// result recording. Injects a fake Prisma directly (no database); guardSend runs before the
// transaction, so the rejection paths need no summary fakes.
import type { PrismaClient } from "@/generated/prisma/client";
import type { PilotJournalService } from "@/modules/pilot/journal.service";
import { CampaignNetworkingService } from "./networking.service";
import { describe, expect, it } from "bun:test";

interface Over {
  message: Record<string, unknown>;
}

/** Fake PilotService recording journal appends (the correction-capture path). */
function makePilot(journals: Record<string, unknown>[]): PilotJournalService {
  return {
    appendJournal: async (_p: string, body: { entries: Record<string, unknown>[] }) => {
      journals.push(...body.entries);
      return { items: [] };
    },
  } as unknown as PilotJournalService;
}

function makeDb(over: Over) {
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
    relatedAppId: null,
    relatedJobUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const base = {
    id: "m1",
    userId: "p1",
    contactId: "ct1",
    campaignId: "c1",
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

  const db = {
    networkingMessage: {
      findFirst: async () => ({ ...base, ...over.message }),
      // Prisma leaves `undefined` fields untouched; mirror that so unchanged columns survive.
      update: async (a: { data: Record<string, unknown> }) => ({
        ...base,
        ...over.message,
        ...Object.fromEntries(Object.entries(a.data).filter(([, v]) => v !== undefined)),
        contact,
      }),
      groupBy: async () => [],
      findMany: async () => [],
    },
    campaign: { update: async () => ({}) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return db;
}

const service = (over: Over) => {
  const journals: Record<string, unknown>[] = [];
  const svc = new CampaignNetworkingService(
    makeDb(over) as unknown as PrismaClient,
    makePilot(journals),
  );
  return { svc, journals };
};

describe("networking send gate: LinkedIn InMail", () => {
  it("rejects a sent result for an unapproved InMail", () => {
    const { svc } = service({
      message: { channel: "linkedin", linkedinKind: "inmail", status: "draft" },
    });
    expect(svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" })).rejects.toThrow();
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
  // rejected (a cap 422 here would leave sentAt null and let the agenda re-emit → duplicate email).
  it("records a sent email result unconditionally, stamping sentAt", async () => {
    const { svc } = service({
      message: { channel: "email", status: "approved" },
    });
    const res = await svc.recordNetworkingResult("p1", "c1", "m1", { outcome: "sent" });
    expect(res.message.status).toBe("sent");
    expect(res.message.sentAt).toBeInstanceOf(Date);
  });
});

describe("networking correction capture", () => {
  it("logs a correction with before/after when a draft's body is edited", async () => {
    const { svc, journals } = service({
      message: { status: "draft", subject: "Hi", body: "hello" },
    });
    await svc.patchNetworking("p1", "c1", "m1", { body: "hello, updated" });

    expect(journals).toHaveLength(1);
    expect(journals[0]).toMatchObject({
      kind: "correction",
      subjectType: "networking",
      subjectId: "m1",
      detail: {
        type: "networking.edited",
        messageId: "m1",
        before: { subject: "Hi", body: "hello" },
        after: { subject: "Hi", body: "hello, updated" },
      },
    });
  });

  it("does not log a correction when the message is not a draft", async () => {
    const { svc, journals } = service({
      message: { status: "approved", subject: "Hi", body: "hello" },
    });
    await svc.patchNetworking("p1", "c1", "m1", { body: "hello, updated" });

    expect(journals).toHaveLength(0);
  });

  it("does not log a correction when a draft edit changes no content", async () => {
    const { svc, journals } = service({
      message: { status: "draft", subject: "Hi", body: "hello" },
    });
    await svc.patchNetworking("p1", "c1", "m1", { status: "approved" });

    expect(journals).toHaveLength(0);
  });
});
