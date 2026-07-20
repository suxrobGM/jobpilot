import type {
  AddCampaignNetworkingInput,
  NetworkingMessageResultInput,
  PatchNetworkingMessageInput,
} from "@jobpilot/contracts/networking";
import {
  isTerminalNetworkingStatus,
  NETWORKING_MESSAGE_TERMINAL_STATUSES,
} from "@jobpilot/contracts/networking";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { publishActivity, writeActivity } from "@/common/activity-log";
import { conflict, findOwned, notFound, unprocessable } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { createContactPayload } from "@/modules/contact";
import { createPaginatedResponse } from "@/types/response";
import { toNetworkingMessageRow } from "../campaign.mapper";
import { deriveCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

/** Owns paginated campaign networking writes and idempotent terminal outcomes. */
@singleton()
export class CampaignNetworkingService {
  constructor(private readonly prisma: PrismaClient) {}

  async listNetworking(userId: string, campaignId: string, query: { page: number; limit: number }) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);
    const where = { campaignId, userId };
    const [messages, total] = await Promise.all([
      this.prisma.networkingMessage.findMany({
        where,
        include: { contact: true },
        orderBy: { createdAt: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.networkingMessage.count({ where }),
    ]);
    return createPaginatedResponse(messages.map(toNetworkingMessageRow), { ...query, total });
  }

  async addNetworking(userId: string, campaignId: string, body: AddCampaignNetworkingInput) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);
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
          campaignId,
          channel: body.message.channel,
          linkedinKind: body.message.linkedinKind ?? null,
          subject: body.message.subject ?? null,
          body: body.message.body,
          status: body.message.status ?? "draft",
        },
        include: { contact: true },
      });
    });
    publish(campaignChannel, { campaignId }, { type: "networking-update" });
    return toNetworkingMessageRow(networkingMessage);
  }

  async patchNetworking(
    userId: string,
    campaignId: string,
    messageId: string,
    body: PatchNetworkingMessageInput,
  ) {
    const existing = await findOwned(
      (where) => this.prisma.networkingMessage.findFirst({ where }),
      { id: messageId, campaignId, userId },
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
          ? await writeActivity(tx, userId, {
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
    publish(campaignChannel, { campaignId }, { type: "networking-update" });
    publishActivity(userId, result.activity);
    return toNetworkingMessageRow(result.message);
  }

  async recordNetworkingResult(
    userId: string,
    campaignId: string,
    messageId: string,
    data: NetworkingMessageResultInput,
  ) {
    const existing = await findOwned(
      (where) =>
        this.prisma.networkingMessage.findFirst({
          where,
          include: { campaign: true, contact: true },
        }),
      { id: messageId, campaignId, userId },
      "Networking message",
    );
    if (!existing.campaign) {
      throw new Error("Campaign-scoped networking message has no campaign relation.");
    }
    const campaignSource = existing.campaign.source;
    if (isTerminalNetworkingStatus(existing.status)) {
      if (existing.status !== data.outcome) {
        throw conflict(`Networking message already finished with outcome ${existing.status}.`);
      }
      return {
        message: toNetworkingMessageRow(existing),
        summary: await deriveCampaignSummary(this.prisma, campaignId, campaignSource),
      };
    }
    if (
      data.outcome === "sent" &&
      existing.channel === "linkedin" &&
      existing.linkedinKind === "inmail"
    ) {
      if (existing.status !== "approved") {
        throw unprocessable("A LinkedIn InMail can only be sent after approval.");
      }
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
      return {
        message,
        summary: await deriveCampaignSummary(tx, campaignId, campaignSource),
      };
    });
    publish(campaignChannel, { campaignId }, { type: "networking-update" });
    return { message: toNetworkingMessageRow(result.message), summary: result.summary };
  }
}
