// syncIfStale in isolation with a fake Prisma - no database, no Gmail; syncInbox is stubbed.

import type { PrismaClient } from "@/generated/prisma/client";
import type { MailboxSessionService } from "../account/mailbox-session.service";
import type { EmailProviders } from "../email-provider";
import { EmailSyncService } from "./sync.service";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-07-23T12:00:00.000Z");
const STALE_MS = 10 * 60 * 1000;
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

function make(account: { lastSyncAt: Date | null } | null, syncImpl?: () => Promise<never>) {
  const prisma = {
    emailAccount: { findUnique: async () => account },
  } as unknown as PrismaClient;
  const svc = new EmailSyncService(prisma, {} as MailboxSessionService, {} as EmailProviders);
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
