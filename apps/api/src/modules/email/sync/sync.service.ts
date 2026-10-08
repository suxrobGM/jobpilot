import { inboxChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { CryptoService } from "@/common/crypto";
import { ErrorCodes, HttpError, notFound } from "@/common/errors";
import { logger } from "@/common/logger";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { loadFreshAccount } from "../account/account.utils";
import { getProvider, rethrowGmailError } from "../gmail.provider";

/** The fields needed to decide whether a freshly synced message is an actual employer reply. */
interface SyncedForLinking {
  providerId: string;
  threadId: string | null;
  fromAddress: string;
  receivedAt: Date;
  isOutbound: boolean;
}

/** A reply must be inbound from a party other than the connected mailbox. */
export function isExternalInboundMessage(message: SyncedForLinking, accountEmail: string): boolean {
  return (
    !message.isOutbound &&
    message.fromAddress.trim().toLowerCase() !== accountEmail.trim().toLowerCase()
  );
}

@singleton()
export class EmailSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
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
    let loaded: Awaited<ReturnType<typeof loadFreshAccount>>;
    try {
      loaded = await loadFreshAccount(this.prisma, this.crypto, userId);
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Token refresh failed",
        401,
      );
    }
    if (!loaded) {
      throw notFound("No email account connected");
    }

    const { account: active, config } = loaded;
    const provider = getProvider(active.provider);

    publish(inboxChannel, { userId }, { type: "sync.started" });

    const result = await provider.syncMessages(config, active).catch(rethrowGmailError);

    let inserted = 0;
    const insertedForLinking: SyncedForLinking[] = [];
    for (const m of result.newMessages) {
      try {
        await this.prisma.emailMessage.create({
          data: {
            accountId: active.id,
            providerId: m.providerId,
            threadId: m.threadId,
            subject: m.subject,
            fromAddress: m.fromAddress,
            fromName: m.fromName,
            fromDomain: m.fromDomain,
            snippet: m.snippet,
            rawBody: m.rawBody,
            receivedAt: m.receivedAt,
          },
        });
        inserted += 1;
        insertedForLinking.push({
          providerId: m.providerId,
          threadId: m.threadId,
          fromAddress: m.fromAddress,
          receivedAt: m.receivedAt,
          isOutbound: m.isOutbound,
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          continue;
        }
        throw e;
      }
    }

    // First undo earlier false positives, then only link verified inbound employer replies.
    await this.reconcileSelfSentReplies(userId, active.id, active.email);
    await this.linkNetworkingReplies(userId, active.email, insertedForLinking);

    await this.prisma.emailAccount.update({
      where: { id: active.id },
      data: {
        historyId: result.historyId ?? active.historyId,
        lastSyncAt: new Date(),
      },
    });

    publish(
      inboxChannel,
      { userId },
      {
        type: "sync.progress",
        fetched: result.fetched,
        new: inserted,
      },
    );

    return { fetched: result.fetched, new: inserted };
  }

  /**
   * Restore records that a previous sync marked replied from a sent copy. A real reply must be
   * an external message from the tracked contact in the same thread.
   */
  private async reconcileSelfSentReplies(userId: string, accountId: string, accountEmail: string) {
    const replied = await this.prisma.networkingMessage.findMany({
      where: { userId, channel: "email", status: "replied", threadId: { not: null } },
      select: { id: true, threadId: true, contact: { select: { email: true } } },
    });
    const threadIds = replied.flatMap((message) => (message.threadId ? [message.threadId] : []));
    if (threadIds.length === 0) return 0;

    const externalMessages = await this.prisma.emailMessage.findMany({
      where: { accountId, threadId: { in: threadIds }, fromAddress: { not: accountEmail } },
      select: { threadId: true, fromAddress: true },
    });
    const externalReplyKeys = new Set(
      externalMessages.map((message) => `${message.threadId}:${message.fromAddress.toLowerCase()}`),
    );
    const staleIds = replied
      .filter(
        (message) =>
          !message.contact.email ||
          !externalReplyKeys.has(`${message.threadId}:${message.contact.email.toLowerCase()}`),
      )
      .map((message) => message.id);
    if (staleIds.length === 0) return 0;

    const restored = await this.prisma.networkingMessage.updateMany({
      where: { id: { in: staleIds }, status: "replied" },
      data: { status: "sent", repliedAt: null },
    });
    return restored.count;
  }

  /**
   * Flip `sent` networking messages to `replied` only for an external message from the tracked
   * contact. Thread membership alone is insufficient because Gmail also syncs sent copies.
   * Returns the number of networking messages newly marked replied.
   */
  private async linkNetworkingReplies(
    userId: string,
    accountEmail: string,
    messages: SyncedForLinking[],
  ): Promise<number> {
    let linked = 0;

    for (const m of messages) {
      if (!isExternalInboundMessage(m, accountEmail) || !m.fromAddress) continue;

      const contacts = await this.prisma.contact.findMany({
        where: { userId, email: m.fromAddress },
        select: { id: true },
      });
      if (contacts.length === 0) continue;
      const contactId = { in: contacts.map((contact) => contact.id) };

      if (m.threadId) {
        const byThread = await this.prisma.networkingMessage.updateMany({
          where: { userId, status: "sent", threadId: m.threadId, contactId },
          data: { status: "replied", repliedAt: m.receivedAt },
        });
        linked += byThread.count;
        if (byThread.count > 0) continue;
      }

      const byEmail = await this.prisma.networkingMessage.updateMany({
        where: { userId, status: "sent", contactId },
        data: { status: "replied", repliedAt: m.receivedAt },
      });
      linked += byEmail.count;
    }

    return linked;
  }
}
