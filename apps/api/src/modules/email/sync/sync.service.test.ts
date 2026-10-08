// syncIfStale in isolation with a fake Prisma - no database, no Gmail; syncInbox is stubbed.
import type { CryptoService } from "@/common/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { EmailSyncService, isExternalInboundMessage } from "./sync.service";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-07-23T12:00:00.000Z");
const STALE_MS = 10 * 60 * 1000;
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

function make(account: { lastSyncAt: Date | null } | null, syncImpl?: () => Promise<never>) {
  const prisma = {
    emailAccount: { findUnique: async () => account },
  } as unknown as PrismaClient;
  const svc = new EmailSyncService(prisma, {} as CryptoService);
  let syncs = 0;
  svc.syncInbox = syncImpl
    ? syncImpl
    : async () => {
        syncs += 1;
        return { fetched: 0, new: 0 };
      };
  return { svc, syncs: () => syncs };
}

describe("EmailSyncService.syncIfStale", () => {
  it("skips when no email account is connected", async () => {
    const { svc, syncs } = make(null);
    await svc.syncIfStale("u1", STALE_MS, NOW);
    expect(syncs()).toBe(0);
  });

  it("skips while the last sync is fresher than the threshold", async () => {
    const { svc, syncs } = make({ lastSyncAt: minutesAgo(5) });
    await svc.syncIfStale("u1", STALE_MS, NOW);
    expect(syncs()).toBe(0);
  });

  it("syncs once the last sync is stale", async () => {
    const { svc, syncs } = make({ lastSyncAt: minutesAgo(11) });
    await svc.syncIfStale("u1", STALE_MS, NOW);
    expect(syncs()).toBe(1);
  });

  it("syncs an account that has never synced", async () => {
    const { svc, syncs } = make({ lastSyncAt: null });
    await svc.syncIfStale("u1", STALE_MS, NOW);
    expect(syncs()).toBe(1);
  });

  it("swallows sync failures so a broken mailbox cannot block the caller", async () => {
    const { svc } = make({ lastSyncAt: null }, async () => {
      throw new Error("token refresh failed");
    });
    await expect(svc.syncIfStale("u1", STALE_MS, NOW)).resolves.toBeUndefined();
  });
});

describe("networking reply correlation", () => {
  const mailbox = "mailbox@example.com";
  const sentAt = new Date("2026-10-08T00:53:30.000Z");

  it("keeps multiple sent copies outbound and awaiting a response", () => {
    const sentCopies = [
      { providerId: "sent-message-1", threadId: "sent-thread-1" },
      { providerId: "sent-message-2", threadId: "sent-thread-2" },
    ];

    for (const message of sentCopies) {
      expect(
        isExternalInboundMessage(
          { ...message, fromAddress: mailbox, receivedAt: sentAt, isOutbound: true },
          mailbox,
        ),
      ).toBe(false);
    }
  });

  it("recognizes an external contact reply in the same thread", () => {
    expect(
      isExternalInboundMessage(
        {
          providerId: "inbound-message-1",
          threadId: "sent-thread-1",
          fromAddress: "employer@example.com",
          receivedAt: sentAt,
          isOutbound: false,
        },
        mailbox,
      ),
    ).toBe(true);
  });

  it("marks a matching external sender in the same thread as replied", async () => {
    const writes: Record<string, unknown>[] = [];
    const db = {
      contact: { findMany: async () => [{ id: "employer-contact" }] },
      networkingMessage: {
        updateMany: async ({ data, where }: { data: Record<string, unknown>; where: unknown }) => {
          writes.push({ data, where });
          return { count: 1 };
        },
      },
    } as unknown as PrismaClient;
    const svc = new EmailSyncService(db, {} as CryptoService) as unknown as {
      linkNetworkingReplies: (
        userId: string,
        accountEmail: string,
        messages: Array<{
          providerId: string;
          threadId: string | null;
          fromAddress: string;
          receivedAt: Date;
          isOutbound: boolean;
        }>,
      ) => Promise<number>;
    };

    expect(
      await svc.linkNetworkingReplies("u1", mailbox, [
        {
          providerId: "inbound-message-1",
          threadId: "sent-thread-1",
          fromAddress: "employer@example.com",
          receivedAt: sentAt,
          isOutbound: false,
        },
      ]),
    ).toBe(1);
    expect(writes).toEqual([
      {
        where: {
          userId: "u1",
          status: "sent",
          threadId: "sent-thread-1",
          contactId: { in: ["employer-contact"] },
        },
        data: { status: "replied", repliedAt: sentAt },
      },
    ]);
  });

  it("restores false self-sent replies while preserving a verified external reply", async () => {
    const writes: Record<string, unknown>[] = [];
    const db = {
      networkingMessage: {
        findMany: async () => [
          {
            id: "first-sent-message",
            threadId: "sent-thread-1",
            contact: { email: "employer@example.com" },
          },
          {
            id: "second-sent-message",
            threadId: "sent-thread-2",
            contact: { email: "other-employer@example.com" },
          },
          {
            id: "verified",
            threadId: "synthetic-thread",
            contact: { email: "recruiter@example.com" },
          },
        ],
        updateMany: async ({ data, where }: { data: Record<string, unknown>; where: unknown }) => {
          writes.push({ data, where });
          return { count: 2 };
        },
      },
      emailMessage: {
        findMany: async () => [
          { threadId: "synthetic-thread", fromAddress: "recruiter@example.com" },
        ],
      },
    } as unknown as PrismaClient;
    const svc = new EmailSyncService(db, {} as CryptoService) as unknown as {
      reconcileSelfSentReplies: (
        userId: string,
        accountId: string,
        accountEmail: string,
      ) => Promise<number>;
    };

    expect(await svc.reconcileSelfSentReplies("u1", "a1", mailbox)).toBe(2);
    expect(writes).toEqual([
      {
        where: { id: { in: ["first-sent-message", "second-sent-message"] }, status: "replied" },
        data: { status: "sent", repliedAt: null },
      },
    ]);
  });
});
