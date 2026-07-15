// Fake-Prisma unit test for the outreach send gates: InMail requires user approval, and email
// sends are blocked once the pilot's daily outreach cap is spent. Injects a fake Prisma directly
// (no database); guardSend runs before the transaction, so the rejection paths need no summary fakes.
import type { PrismaClient } from "@/generated/prisma/client";
import { CampaignOutreachService } from "./outreach.service";
import { describe, expect, it } from "bun:test";

interface Over {
  message: Record<string, unknown>;
  mandateConfig?: string;
  sentToday?: number;
}

function makeDb(over: Over) {
  const contact = {
    id: "ct1",
    profileId: "p1",
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
    profileId: "p1",
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
    outreachMessage: {
      findFirst: async () => ({ ...base, ...over.message }),
      count: async () => over.sentToday ?? 0,
      update: async (a: { data: Record<string, unknown> }) => ({
        ...base,
        ...over.message,
        ...a.data,
        contact,
      }),
      groupBy: async () => [],
      findMany: async () => [],
    },
    pilotState: {
      findUnique: async () => ({ mandateConfig: over.mandateConfig ?? "{}" }),
    },
    campaign: { update: async () => ({}) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return db;
}

const service = (over: Over) =>
  new CampaignOutreachService(makeDb(over) as unknown as PrismaClient);

describe("outreach send gate: LinkedIn InMail", () => {
  it("rejects a sent result for an unapproved InMail", () => {
    const svc = service({
      message: { channel: "linkedin", linkedinKind: "inmail", status: "draft" },
    });
    expect(svc.recordOutreachResult("p1", "c1", "m1", { outcome: "sent" })).rejects.toThrow();
  });

  it("allows a sent result once the InMail is approved", async () => {
    const svc = service({
      message: { channel: "linkedin", linkedinKind: "inmail", status: "approved" },
    });
    const res = await svc.recordOutreachResult("p1", "c1", "m1", { outcome: "sent" });
    expect(res.message.status).toBe("sent");
  });
});

describe("outreach send gate: email daily cap", () => {
  it("rejects a sent email result when the cap is already spent", () => {
    const svc = service({
      message: { channel: "email", status: "approved" },
      mandateConfig: JSON.stringify({ dailyOutreachCap: 2 }),
      sentToday: 2,
    });
    expect(svc.recordOutreachResult("p1", "c1", "m1", { outcome: "sent" })).rejects.toThrow();
  });

  it("allows a sent email result while under the cap", async () => {
    const svc = service({
      message: { channel: "email", status: "approved" },
      mandateConfig: JSON.stringify({ dailyOutreachCap: 5 }),
      sentToday: 1,
    });
    const res = await svc.recordOutreachResult("p1", "c1", "m1", { outcome: "sent" });
    expect(res.message.status).toBe("sent");
  });
});
