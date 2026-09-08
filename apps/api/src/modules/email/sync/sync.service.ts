import { inboxChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { CryptoService } from "@/common/crypto";
import { ErrorCodes, HttpError, notFound } from "@/common/errors";
import { logger } from "@/common/logger";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { loadFreshAccount } from "../account/account.utils";
import { getProvider, rethrowGmailError } from "../gmail.provider";

/** The fields the reply-linker needs from a freshly-synced inbound message. */
interface InboundForLinking {
  threadId: string | null;
  fromAddress: string;
  receivedAt: Date;
}

@singleton()
export class EmailSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Best-effort pull for the pilot's agenda compile: skips when no account is connected or the
   * last sync is fresher than `staleMs`, and swallows failures - a broken mailbox must never
   * block the agenda.
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
    const insertedForLinking: InboundForLinking[] = [];
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
          threadId: m.threadId,
          fromAddress: m.fromAddress,
          receivedAt: m.receivedAt,
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          continue;
        }
        throw e;
      }
    }

    // Flip any sent networking messages to "replied" when their reply just arrived.
    await this.linkNetworkingReplies(userId, insertedForLinking);

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
   * Flip `sent` networking messages to `replied` when a matching inbound email
   * arrives. Matches first by Gmail `threadId` (the thread the networking message was sent
   * on), then falls back to the sender address equalling a contact's email.
   * Returns the number of networking messages newly marked replied.
   */
  private async linkNetworkingReplies(
    userId: string,
    messages: InboundForLinking[],
  ): Promise<number> {
    let linked = 0;

    for (const m of messages) {
      if (m.threadId) {
        const byThread = await this.prisma.networkingMessage.updateMany({
          where: { userId, status: "sent", threadId: m.threadId },
          data: { status: "replied", repliedAt: m.receivedAt },
        });
        linked += byThread.count;
        if (byThread.count > 0) continue;
      }

      if (m.fromAddress) {
        const contacts = await this.prisma.contact.findMany({
          where: { userId, email: m.fromAddress },
          select: { id: true },
        });
        if (contacts.length > 0) {
          const byEmail = await this.prisma.networkingMessage.updateMany({
            where: { userId, status: "sent", contactId: { in: contacts.map((c) => c.id) } },
            data: { status: "replied", repliedAt: m.receivedAt },
          });
          linked += byEmail.count;
        }
      }
    }

    return linked;
  }
}
