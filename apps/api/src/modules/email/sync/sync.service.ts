import { inboxChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { CryptoService } from "@/common/crypto";
import { ErrorCodes, HttpError, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { loadFreshAccount } from "../account/account.utils";
import { getProvider } from "../gmail.provider";

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

  async syncInbox(userId: string, profileId: string) {
    let loaded: Awaited<ReturnType<typeof loadFreshAccount>>;
    try {
      loaded = await loadFreshAccount(this.prisma, this.crypto, userId, profileId);
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

    publish(inboxChannel, { profileId }, { type: "sync.started" });

    const result = await provider.syncMessages(config, active);

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
    await this.linkNetworkingReplies(profileId, insertedForLinking);

    await this.prisma.emailAccount.update({
      where: { id: active.id },
      data: {
        historyId: result.historyId ?? active.historyId,
        lastSyncAt: new Date(),
      },
    });

    publish(
      inboxChannel,
      { profileId },
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
    profileId: string,
    messages: InboundForLinking[],
  ): Promise<number> {
    let linked = 0;

    for (const m of messages) {
      if (m.threadId) {
        const byThread = await this.prisma.networkingMessage.updateMany({
          where: { profileId, status: "sent", threadId: m.threadId },
          data: { status: "replied", repliedAt: m.receivedAt },
        });
        linked += byThread.count;
        if (byThread.count > 0) continue;
      }

      if (m.fromAddress) {
        const contacts = await this.prisma.contact.findMany({
          where: { profileId, email: m.fromAddress },
          select: { id: true },
        });
        if (contacts.length > 0) {
          const byEmail = await this.prisma.networkingMessage.updateMany({
            where: { profileId, status: "sent", contactId: { in: contacts.map((c) => c.id) } },
            data: { status: "replied", repliedAt: m.receivedAt },
          });
          linked += byEmail.count;
        }
      }
    }

    return linked;
  }
}
