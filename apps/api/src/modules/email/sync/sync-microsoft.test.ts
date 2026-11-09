import type { PrismaClient } from "@/generated/prisma/client";
import type { MailboxSessionService } from "../account/mailbox-session.service";
import type { GmailClient } from "../gmail.client";
import type { MicrosoftClient } from "../microsoft.client";
import { EmailSyncService } from "./sync.service";
import { describe, expect, it } from "bun:test";

function setup(options: { failStore?: boolean; inserted?: number } = {}) {
  const cutoff = new Date(Date.now() - 5 * 60_000);
  const updates: { data: Record<string, unknown> }[] = [];
  let since: number | undefined;
  const account = {
    id: "account",
    provider: "microsoft",
    lastSyncAt: new Date(Date.now() - 60 * 60_000),
    clearedBefore: cutoff,
    deltaLink: "old-cursor",
  };
  const prisma = {
    emailAccount: { update: async (args: { data: Record<string, unknown> }) => updates.push(args) },
    emailMessage: {
      createMany: async () => {
        if (options.failStore) {
          throw new Error("storage unavailable");
        }
        return { count: options.inserted ?? 1 };
      },
    },
    networkingMessage: { findMany: async () => [] },
  } as unknown as PrismaClient;
  const sessions = {
    open: async () => ({ account, session: {} }),
  } as unknown as MailboxSessionService;
  const microsoft = {
    sync: async (_session: unknown, windowStart: number) => {
      since = windowStart;
      return {
        fetched: 1,
        deltaLink: "new-cursor",
        newMessages: [{ providerId: "message", links: [], receivedAt: new Date() }],
      };
    },
  } as unknown as MicrosoftClient;
  return {
    service: new EmailSyncService(prisma, sessions, {} as GmailClient, microsoft),
    cutoff,
    updates,
    since: () => since,
  };
}

describe("Microsoft inbox persistence", () => {
  it("respects the cleared-inbox boundary and advances the cursor after storage", async () => {
    const test = setup();
    expect(await test.service.syncInbox("user")).toEqual({ fetched: 1, new: 1 });
    expect(test.since()).toBe(test.cutoff.getTime());
    expect(test.updates[0].data.deltaLink).toBe("new-cursor");
    expect(test.updates[0].data.lastSyncAt).toBeInstanceOf(Date);
  });

  it("does not advance sync state after a storage failure", async () => {
    const test = setup({ failStore: true });
    await expect(test.service.syncInbox("user")).rejects.toThrow("storage unavailable");
    expect(test.updates).toHaveLength(0);
  });

  it("counts duplicate imports as zero while accepting the completed delta", async () => {
    const test = setup({ inserted: 0 });
    expect(await test.service.syncInbox("user")).toEqual({ fetched: 1, new: 0 });
    expect(test.updates[0].data.deltaLink).toBe("new-cursor");
  });
});
