import { inboxChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { DAY_MS } from "@/common/date/buckets";
import { notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { logger } from "@/common/logger";
import { publish } from "@/common/sse";
import { type EmailAccount, PrismaClient } from "@/generated/prisma/client";
import { MailboxSessionService } from "../account/mailbox-session.service";
import { GmailClient } from "../gmail.client";
import type { NormalizedMessage } from "../gmail.types";

/** How far back the first sync after connecting reaches. */
const FIRST_SYNC_DAYS = 14;

/** Fetched and stored together, so a failed sync keeps what it already stored. */
const STORE_CHUNK = 100;

type SyncedAccount = Pick<EmailAccount, "lastSyncAt" | "clearedBefore">;

/** A day of overlap covers late delivery; stored ids are skipped before fetching anyway. */
function syncWindowStart(account: SyncedAccount, now: Date): Date {
  const { lastSyncAt, clearedBefore } = account;
  const start = lastSyncAt
    ? new Date(lastSyncAt.getTime() - DAY_MS)
    : new Date(now.getTime() - FIRST_SYNC_DAYS * DAY_MS);
  if (clearedBefore && clearedBefore > start) {
    return clearedBefore;
  }
  return start;
}

@injectable()
export class EmailSyncService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly sessions = inject(MailboxSessionService),
    private readonly gmail = inject(GmailClient),
  ) {}

  /**
   * Best-effort pull for the pilot's task list refresh: skips when no account is connected or the
   * last sync is fresher than `staleMs`, and swallows failures - a broken mailbox must never
   * block the task list.
   */
  async syncIfStale(userId: string, staleMs: number, now: Date): Promise<void> {
    const account = await this.prisma.emailAccount.findUnique({
      where: { userId },
      select: { lastSyncAt: true },
    });

    if (!account) {
      return;
    }

    const syncedRecently =
      account.lastSyncAt !== null && now.getTime() - account.lastSyncAt.getTime() < staleMs;

    if (syncedRecently) {
      return;
    }

    try {
      await this.syncInbox(userId);
    } catch (err) {
      logger.error({ err, userId }, "Pilot inbox sync failed");
    }
  }

  async syncInbox(userId: string) {
    const mailbox = await this.sessions.open(userId);
    if (!mailbox) {
      throw notFound("No email account connected");
    }
    const { account, session } = mailbox;

    publish(inboxChannel, { userId }, { type: "sync.started" });

    const startedAt = new Date();
    const ids = await this.gmail.listMessageIds(session, syncWindowStart(account, startedAt));
    const unstored = await this.unstoredIds(account.id, ids);

    let count = 0;
    for (let i = 0; i < unstored.length; i += STORE_CHUNK) {
      const messages = await this.gmail.getMessages(session, unstored.slice(i, i + STORE_CHUNK));
      // skipDuplicates: a concurrent sync may have stored some of them meanwhile.
      const created = await this.prisma.emailMessage.createMany({
        data: messages.map((m) => ({ ...m, accountId: account.id, links: toInputJson(m.links) })),
        skipDuplicates: true,
      });
      count += created.count;
      await this.linkNetworkingReplies(userId, messages);
    }
    await this.prisma.emailAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: startedAt },
    });

    const result = { fetched: ids.length, new: count };
    publish(inboxChannel, { userId }, { type: "sync.progress", ...result });
    return result;
  }

  private async unstoredIds(accountId: string, ids: string[]): Promise<string[]> {
    const stored = await this.prisma.emailMessage.findMany({
      where: { accountId, providerId: { in: ids } },
      select: { providerId: true },
    });
    const storedIds = new Set(stored.map((m) => m.providerId));
    return ids.filter((id) => !storedIds.has(id));
  }

  /**
   * Flips `sent` networking messages to `replied` when their reply arrives: by Gmail thread first,
   * else by the sender matching a contact's email. Matched in memory: most users have none sent.
   */
  private async linkNetworkingReplies(
    userId: string,
    messages: NormalizedMessage[],
  ): Promise<void> {
    const sent = await this.prisma.networkingMessage.findMany({
      where: { userId, status: "sent" },
      select: { id: true, threadId: true, contact: { select: { email: true } } },
    });
    if (sent.length === 0) {
      return;
    }

    const sentThreads = new Set(sent.map((s) => s.threadId));
    const repliedAt = new Map<string, Date>();
    for (const m of messages) {
      const byThread = m.threadId !== null && sentThreads.has(m.threadId);
      for (const s of sent) {
        const matches = byThread ? s.threadId === m.threadId : s.contact.email === m.fromAddress;
        if (matches && m.fromAddress && !repliedAt.has(s.id)) {
          repliedAt.set(s.id, m.receivedAt);
        }
      }
    }

    await this.prisma.$transaction(
      [...repliedAt].map(([id, at]) =>
        this.prisma.networkingMessage.updateMany({
          where: { id, status: "sent" },
          data: { status: "replied", repliedAt: at },
        }),
      ),
    );
  }
}
