import {
  type AddCampaignNetworkingInput,
  type NetworkingMessageResultInput,
  type PatchNetworkingMessageInput,
} from "@jobpilot/contracts/networking";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { findOwned, notFound, unprocessable } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { createContactPayload } from "@/modules/contact";
import { PilotService } from "@/modules/pilot/pilot.service";
import { toNetworkingMessageRow } from "../campaign.mapper";
import { recomputeNetworkingSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

@singleton()
export class CampaignNetworkingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pilot: PilotService,
  ) {}

  /** List the campaign's networking messages (with their contacts) for the board. */
  async listNetworking(profileId: string, campaignId: string) {
    const messages = await this.prisma.networkingMessage.findMany({
      where: { campaignId, profileId },
      include: { contact: true },
      orderBy: { id: "asc" },
    });
    return messages.map(toNetworkingMessageRow);
  }

  /**
   * Add a discovered contact (or attach to an existing `contactId`) plus an
   * initial draft message to the campaign, then recompute the campaign summary.
   */
  async addNetworking(profileId: string, campaignId: string, body: AddCampaignNetworkingInput) {
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

      const networkingMessage = await tx.networkingMessage.create({
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

      const summary = await recomputeNetworkingSummary(tx, campaignId);
      return { networkingMessage, summary };
    });

    if (!result) {
      throw notFound("Contact not found");
    }

    // Push the new contact/message to the live campaign viewer.
    publish(campaignChannel, { campaignId }, { type: "networking-update" });
    return toNetworkingMessageRow(result.networkingMessage);
  }

  /**
   * Non-terminal edits to a networking message - draft body/subject edits,
   * `draft → approved`, and (via `contactLinkedinConnection`) the parent contact's
   * connection state. Terminal outcomes go through `recordNetworkingResult`.
   */
  async patchNetworking(
    profileId: string,
    campaignId: string,
    messageId: string,
    body: PatchNetworkingMessageInput,
  ) {
    const existing = await findOwned(
      (where) =>
        this.prisma.networkingMessage.findFirst({
          where,
          select: { id: true, status: true, subject: true, body: true },
        }),
      { id: messageId, campaignId, profileId },
      "Networking message",
    );

    const { contactLinkedinConnection, ...fields } = body;

    const updated = await this.prisma.$transaction(async (tx) => {
      const message = await tx.networkingMessage.update({
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
        await recomputeNetworkingSummary(tx, campaignId);
      }
      return message;
    });

    // Refresh the live campaign board (e.g. a regenerated draft) without a reload.
    publish(campaignChannel, { campaignId }, { type: "networking-update" });

    // Draft-only approximation of a user edit: the agent regenerates drafts through this same route,
    // so we can't perfectly separate the two - gate on "draft" and treat any content change as a correction.
    const subjectChanged = fields.subject != null && fields.subject !== existing.subject;
    const bodyChanged = fields.body != null && fields.body !== existing.body;
    if (existing.status === "draft" && (subjectChanged || bodyChanged)) {
      await this.pilot.appendJournal(profileId, {
        entries: [
          {
            kind: "correction",
            summary: "Edited networking draft.",
            detail: {
              type: "networking.edited",
              messageId,
              before: { subject: existing.subject, body: existing.body },
              after: { subject: updated.subject, body: updated.body },
            },
            subjectType: "networking",
            subjectId: messageId,
          },
        ],
      });
    }

    return toNetworkingMessageRow(updated);
  }

  /**
   * Server-side send gate, enforced regardless of what the agent claims: a LinkedIn InMail may
   * only be sent once the user approved it (InMails cost credits / are irreversible). The daily
   * networking cap is NOT checked here - this runs after the email already left, so rejecting the
   * bookkeeping would leave sentAt null and let the agenda re-emit the message (duplicate email);
   * the agenda's headroom slicing is the real cap gate.
   */
  private guardSend(message: {
    channel: string;
    linkedinKind: string | null;
    status: string;
  }): void {
    if (message.channel === "linkedin" && message.linkedinKind === "inmail") {
      if (message.status !== "approved") {
        throw unprocessable("A LinkedIn InMail can only be sent after you approve it.");
      }
    }
  }

  /**
   * Terminal-outcome handoff for a networking message: marks it `sent`/`failed`/
   * `skipped`, stamps `sentAt` + the Gmail `providerId`/`threadId`, and recomputes
   * the campaign summary. Mirrors campaigns/[id]/jobs/[key]/result.
   */
  async recordNetworkingResult(
    profileId: string,
    campaignId: string,
    messageId: string,
    data: NetworkingMessageResultInput,
  ) {
    const existing = await findOwned(
      (where) => this.prisma.networkingMessage.findFirst({ where }),
      { id: messageId, campaignId, profileId },
      "Networking message",
    );

    if (data.outcome === "sent") {
      this.guardSend(existing);
    }

    const sentAt =
      data.outcome === "sent" ? (data.sentAt ? new Date(data.sentAt) : new Date()) : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.networkingMessage.update({
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
      const summary = await recomputeNetworkingSummary(tx, campaignId);
      return { message, summary };
    });

    // Refresh the live campaign viewer on the terminal outcome.
    publish(campaignChannel, { campaignId }, { type: "networking-update" });
    return { message: toNetworkingMessageRow(result.message), summary: result.summary };
  }
}
