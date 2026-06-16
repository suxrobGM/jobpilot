import {
  type AddCampaignOutreachInput,
  type OutreachMessageResultInput,
  type PatchOutreachMessageInput,
} from "@jobpilot/contracts/outreach";
import { singleton } from "tsyringe";
import { findOwned, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import { campaignChannel } from "@/common/sse/channels/campaign";
import { PrismaClient } from "@/generated/prisma/client";
import { createContactPayload } from "@/modules/contact";
import { toOutreachMessageRow } from "../campaign.mapper";
import { recomputeOutreachSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

@singleton()
export class CampaignOutreachService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List the campaign's outreach messages (with their contacts) for the board. */
  async listOutreach(profileId: number, campaignId: string) {
    const messages = await this.prisma.outreachMessage.findMany({
      where: { campaignId, profileId },
      include: { contact: true },
      orderBy: { id: "asc" },
    });
    return messages.map(toOutreachMessageRow);
  }

  /**
   * Add a discovered contact (or attach to an existing `contactId`) plus an
   * initial draft message to the campaign, then recompute the campaign summary.
   */
  async addOutreach(profileId: number, campaignId: string, body: AddCampaignOutreachInput) {
    await ensureCampaignOwned(this.prisma, profileId, campaignId);

    const { contact, contactId, message } = body;

    const result = await this.prisma.$transaction(async (tx) => {
      let resolvedContactId = contactId;

      if (resolvedContactId != null) {
        const existing = await tx.contact.findFirst({
          where: { id: resolvedContactId, profileId },
          select: { id: true },
        });
        if (!existing) {
          return null;
        }
      } else if (contact) {
        const created = await tx.contact.create({
          data: { profileId, ...createContactPayload(contact) },
        });
        resolvedContactId = created.id;
      }

      const outreachMessage = await tx.outreachMessage.create({
        data: {
          profileId,
          contactId: resolvedContactId!,
          campaignId,
          channel: message.channel,
          linkedinKind: message.linkedinKind ?? null,
          subject: message.subject ?? null,
          body: message.body,
          status: message.status ?? "draft",
        },
        include: { contact: true },
      });

      const summary = await recomputeOutreachSummary(tx, campaignId);
      return { outreachMessage, summary };
    });

    if (!result) {
      throw notFound("Contact not found");
    }

    // Push the new contact/message to the live campaign viewer.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return toOutreachMessageRow(result.outreachMessage);
  }

  /**
   * Non-terminal edits to an outreach message — draft body/subject edits,
   * `draft → approved`, and (via `contactLinkedinConnection`) the parent contact's
   * connection state. Terminal outcomes go through `recordOutreachResult`.
   */
  async patchOutreach(
    profileId: number,
    campaignId: string,
    messageId: number,
    body: PatchOutreachMessageInput,
  ) {
    await findOwned(
      (where) => this.prisma.outreachMessage.findFirst({ where, select: { id: true } }),
      { id: messageId, campaignId, profileId },
      "Outreach message",
    );

    const { contactLinkedinConnection, ...fields } = body;

    const updated = await this.prisma.$transaction(async (tx) => {
      const message = await tx.outreachMessage.update({
        where: { id: messageId },
        data: {
          status: fields.status,
          subject: fields.subject,
          body: fields.body,
          failReason: fields.failReason,
          providerId: fields.providerId,
          threadId: fields.threadId,
        },
        include: { contact: true },
      });

      if (contactLinkedinConnection) {
        await tx.contact.update({
          where: { id: message.contactId },
          data: { linkedinConnection: contactLinkedinConnection },
        });
        message.contact.linkedinConnection = contactLinkedinConnection;
      }

      // Tile counts only move on a status change; skip the recompute on draft edits.
      if (fields.status) {
        await recomputeOutreachSummary(tx, campaignId);
      }
      return message;
    });

    // Refresh the live campaign board (e.g. a regenerated draft) without a reload.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return toOutreachMessageRow(updated);
  }

  /**
   * Terminal-outcome handoff for an outreach message: marks it `sent`/`failed`/
   * `skipped`, stamps `sentAt` + the Gmail `providerId`/`threadId`, and recomputes
   * the campaign summary. Mirrors campaigns/[id]/jobs/[key]/result.
   */
  async recordOutreachResult(
    profileId: number,
    campaignId: string,
    messageId: number,
    data: OutreachMessageResultInput,
  ) {
    const existing = await findOwned(
      (where) => this.prisma.outreachMessage.findFirst({ where }),
      { id: messageId, campaignId, profileId },
      "Outreach message",
    );

    const sentAt =
      data.outcome === "sent" ? (data.sentAt ? new Date(data.sentAt) : new Date()) : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.outreachMessage.update({
        where: { id: messageId },
        data: {
          status: data.outcome,
          sentAt,
          providerId: data.outcome === "sent" ? (data.providerId ?? existing.providerId) : null,
          threadId:
            data.outcome === "sent" ? (data.threadId ?? existing.threadId) : existing.threadId,
          failReason: data.outcome === "failed" ? data.failReason : null,
        },
        include: { contact: true },
      });
      const summary = await recomputeOutreachSummary(tx, campaignId);
      return { message, summary };
    });

    // Refresh the live campaign viewer on the terminal outcome.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return { message: toOutreachMessageRow(result.message), summary: result.summary };
  }
}
