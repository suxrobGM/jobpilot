import {
  type AddCampaignOutreachInput,
  type OutreachMessageResultInput,
  type PatchOutreachMessageInput,
} from "@jobpilot/contracts/outreach";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { findOwned, notFound, unprocessable } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { createContactPayload } from "@/modules/contact";
import { loadMandateConfig } from "@/modules/pilot/pilot.instructions";
import { PilotService } from "@/modules/pilot/pilot.service";
import { countSentToday } from "@/modules/pilot/pilot.stats";
import { toOutreachMessageRow } from "../campaign.mapper";
import { recomputeOutreachSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

@singleton()
export class CampaignOutreachService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pilot: PilotService,
  ) {}

  /** List the campaign's outreach messages (with their contacts) for the board. */
  async listOutreach(profileId: string, campaignId: string) {
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
  async addOutreach(profileId: string, campaignId: string, body: AddCampaignOutreachInput) {
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
   * Non-terminal edits to an outreach message - draft body/subject edits,
   * `draft → approved`, and (via `contactLinkedinConnection`) the parent contact's
   * connection state. Terminal outcomes go through `recordOutreachResult`.
   */
  async patchOutreach(
    profileId: string,
    campaignId: string,
    messageId: string,
    body: PatchOutreachMessageInput,
  ) {
    const existing = await findOwned(
      (where) =>
        this.prisma.outreachMessage.findFirst({
          where,
          select: { id: true, status: true, subject: true, body: true },
        }),
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

    // Draft-only approximation of a user edit: the agent regenerates drafts through this same route,
    // so we can't perfectly separate the two - gate on "draft" and treat any content change as a correction.
    const subjectChanged = fields.subject != null && fields.subject !== existing.subject;
    const bodyChanged = fields.body != null && fields.body !== existing.body;
    if (existing.status === "draft" && (subjectChanged || bodyChanged)) {
      await this.pilot.appendJournal(profileId, {
        entries: [
          {
            kind: "correction",
            summary: "Edited outreach draft.",
            detail: {
              type: "outreach.edited",
              messageId,
              before: { subject: existing.subject, body: existing.body },
              after: { subject: updated.subject, body: updated.body },
            },
            subjectType: "outreach",
            subjectId: messageId,
          },
        ],
      });
    }

    return toOutreachMessageRow(updated);
  }

  /**
   * Server-side send gates, enforced regardless of what the agent claims: a LinkedIn InMail
   * may only be sent once the user approved it (InMails cost credits / are irreversible), and
   * an email send is blocked once the profile's daily outreach cap is spent.
   */
  private async guardSend(
    profileId: string,
    message: { channel: string; linkedinKind: string | null; status: string },
  ): Promise<void> {
    if (message.channel === "linkedin" && message.linkedinKind === "inmail") {
      if (message.status !== "approved") {
        throw unprocessable("A LinkedIn InMail can only be sent after you approve it.");
      }
      return;
    }
    if (message.channel === "email") {
      const config = await loadMandateConfig(this.prisma, profileId);
      const sentToday = await countSentToday(
        this.prisma,
        profileId,
        new Date(),
        config.activeHours?.tz,
      );
      if (sentToday >= config.dailyOutreachCap) {
        throw unprocessable("Daily outreach cap reached; try again tomorrow.");
      }
    }
  }

  /**
   * Terminal-outcome handoff for an outreach message: marks it `sent`/`failed`/
   * `skipped`, stamps `sentAt` + the Gmail `providerId`/`threadId`, and recomputes
   * the campaign summary. Mirrors campaigns/[id]/jobs/[key]/result.
   */
  async recordOutreachResult(
    profileId: string,
    campaignId: string,
    messageId: string,
    data: OutreachMessageResultInput,
  ) {
    const existing = await findOwned(
      (where) => this.prisma.outreachMessage.findFirst({ where }),
      { id: messageId, campaignId, profileId },
      "Outreach message",
    );

    if (data.outcome === "sent") {
      await this.guardSend(profileId, existing);
    }

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
