import type {
  AddFeedNetworkingInput,
  NetworkingMessageResultInput,
  PatchNetworkingMessageInput,
} from "@jobpilot/contracts/networking";
import {
  isTerminalNetworkingStatus,
  NETWORKING_MESSAGE_TERMINAL_STATUSES,
  type NetworkingMessageStatus,
} from "@jobpilot/contracts/networking";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, notFound, unprocessable } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { createContactPayload } from "@/modules/contact/contact.mapper";
import { ensureFeedOwned } from "@/modules/feed/feed.utils";
import { publishJournalEntries, writeJournalEntries } from "@/modules/pilot/journal-entries";

export interface NetworkingMessageFilters {
  feedId?: string;
  status?: NetworkingMessageStatus;
  /** A feed board reads in drafting order; the cross-feed list reads newest first. */
  order?: "asc" | "desc";
}

@injectable()
export class NetworkingService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** A feed's board when `feedId` is set, otherwise every feed's messages. */
  async listNetworking(userId: string, query: PaginationQuery & NetworkingMessageFilters) {
    const { feedId, status, order = "asc" } = query;
    const where: Prisma.NetworkingMessageWhereInput = {
      userId,
      ...(feedId && { feedId }),
      ...(status && { status }),
    };
    // The page is already ownership-scoped; the probe only tells a 404 from an empty page.
    const [, messages, total] = await Promise.all([
      feedId ? ensureFeedOwned(this.prisma, userId, feedId) : null,
      this.prisma.networkingMessage.findMany({
        where,
        include: { contact: true },
        orderBy: { createdAt: order },
        ...pageSlice(query),
      }),
      this.prisma.networkingMessage.count({ where }),
    ]);
    return paginate(messages, query, total);
  }

  async addNetworking(userId: string, feedId: string, body: AddFeedNetworkingInput) {
    await ensureFeedOwned(this.prisma, userId, feedId);
    const networkingMessage = await this.prisma.$transaction(async (tx) => {
      let contactId = body.contactId;
      if (contactId) {
        const owned = await tx.contact.findFirst({
          where: { id: contactId, userId },
          select: { id: true },
        });
        if (!owned) throw notFound("Contact not found");
      } else if (body.contact) {
        contactId = (
          await tx.contact.create({ data: { userId, ...createContactPayload(body.contact) } })
        ).id;
      }
      if (!contactId) throw unprocessable("A contact is required.");
      return tx.networkingMessage.create({
        data: {
          userId,
          contactId,
          feedId,
          channel: body.message.channel,
          linkedinKind: body.message.linkedinKind ?? null,
          subject: body.message.subject ?? null,
          body: body.message.body,
          status: body.message.status ?? "draft",
        },
        include: { contact: true },
      });
    });
    return networkingMessage;
  }

  async patchNetworking(
    userId: string,
    feedId: string,
    messageId: string,
    body: PatchNetworkingMessageInput,
  ) {
    const existing = await findOwned(
      (where) => this.prisma.networkingMessage.findFirst({ where }),
      { id: messageId, feedId, userId },
      "Networking message",
    );
    if (isTerminalNetworkingStatus(existing.status)) {
      throw conflict("Terminal networking messages cannot be edited.");
    }
    const subjectChanged = body.subject !== undefined && body.subject !== existing.subject;
    const bodyChanged = body.body !== undefined && body.body !== existing.body;
    const result = await this.prisma.$transaction(async (tx) => {
      if (body.status && body.status !== existing.status) {
        const changed = await tx.networkingMessage.updateMany({
          where: { id: messageId, status: existing.status },
          data: { status: body.status },
        });
        if (changed.count === 0) throw conflict("Networking message changed concurrently.");
      }
      const message = await tx.networkingMessage.update({
        where: { id: messageId },
        data: { subject: body.subject, body: body.body },
        include: { contact: true },
      });
      if (body.contactLinkedinConnection) {
        await tx.contact.update({
          where: { id: message.contactId },
          data: { linkedinConnection: body.contactLinkedinConnection },
        });
        message.contact.linkedinConnection = body.contactLinkedinConnection;
      }
      const activity =
        existing.status === "draft" && (subjectChanged || bodyChanged)
          ? await writeJournalEntries(tx, userId, {
              entries: [
                {
                  kind: "correction",
                  summary: "Edited networking draft.",
                  detail: {
                    type: "networking.edited",
                    messageId,
                    before: { subject: existing.subject, body: existing.body },
                    after: { subject: message.subject, body: message.body },
                  },
                  subjectType: "networking",
                  subjectId: messageId,
                },
              ],
            })
          : [];
      return { message, activity };
    });
    publishJournalEntries(userId, result.activity);
    return result.message;
  }

  async recordNetworkingResult(
    userId: string,
    feedId: string,
    messageId: string,
    data: NetworkingMessageResultInput,
  ) {
    const existing = await findOwned(
      (where) =>
        this.prisma.networkingMessage.findFirst({
          where,
          include: { contact: true },
        }),
      { id: messageId, feedId, userId },
      "Networking message",
    );
    if (isTerminalNetworkingStatus(existing.status)) {
      if (existing.status !== data.outcome) {
        throw conflict(`Networking message already finished with outcome ${existing.status}.`);
      }
      return { message: existing };
    }
    const isInMail = existing.channel === "linkedin" && existing.linkedinKind === "inmail";
    if (data.outcome === "sent" && isInMail && existing.status !== "approved") {
      throw unprocessable("A LinkedIn InMail can only be sent after approval.");
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.networkingMessage.updateMany({
        where: { id: messageId, status: { notIn: [...NETWORKING_MESSAGE_TERMINAL_STATUSES] } },
        data: {
          status: data.outcome,
          sentAt: data.outcome === "sent" ? new Date(data.sentAt ?? Date.now()) : null,
          providerId: data.outcome === "sent" ? (data.providerId ?? existing.providerId) : null,
          threadId:
            data.outcome === "sent" ? (data.threadId ?? existing.threadId) : existing.threadId,
          failReason: data.outcome === "failed" ? data.failReason : null,
        },
      });
      if (changed.count === 0) {
        const raced = await tx.networkingMessage.findUniqueOrThrow({ where: { id: messageId } });
        if (raced.status !== data.outcome) {
          throw conflict(`Networking message already finished with outcome ${raced.status}.`);
        }
      }
      const message = await tx.networkingMessage.findUniqueOrThrow({
        where: { id: messageId },
        include: { contact: true },
      });
      return { message };
    });
    return result;
  }
}
