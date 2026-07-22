import type {
  CampaignSource,
  CampaignStatusCommandInput,
  CreateCampaignInput,
  UpdateCampaignConfigInput,
} from "@jobpilot/contracts/campaign";
import { campaignConfigSupportsSource } from "@jobpilot/contracts/campaign";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned, unprocessable } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type Campaign,
  type CampaignStatus,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { createPaginatedResponse } from "@/types/response";
import { toCampaignRow, toPrismaCampaignSource, toWireCampaignSource } from "./campaign.mapper";
import {
  deriveCampaignSummary,
  emptyJobSummary,
  emptyNetworkingSummary,
  loadCampaignSummaries,
} from "./campaign.summary";
import { ensureCampaignOwned, publishCampaignCompleted } from "./campaign.utils";

function requireSummary(
  summaries: Awaited<ReturnType<typeof loadCampaignSummaries>>,
  campaignId: string,
) {
  const summary = summaries.get(campaignId);
  if (!summary) throw new Error(`Missing derived summary for campaign ${campaignId}.`);
  return summary;
}

const STATUS_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  in_progress: ["paused", "completed", "failed"],
  paused: ["in_progress", "completed", "failed"],
  completed: [],
  failed: [],
};

/** Owns campaign CRUD, validated lifecycle commands, pagination, and derived DTOs. */
@singleton()
export class CampaignService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    userId: string,
    query: { page: number; limit: number; status?: CampaignStatus; source?: CampaignSource },
  ) {
    const where: Prisma.CampaignWhereInput = {
      userId,
      status: query.status,
      source: query.source ? toPrismaCampaignSource(query.source) : undefined,
    };
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    const summaries = await loadCampaignSummaries(this.prisma, campaigns);
    return createPaginatedResponse(
      campaigns.map((campaign) =>
        toCampaignRow(campaign, requireSummary(summaries, campaign.campaignId)),
      ),
      { page: query.page, limit: query.limit, total },
    );
  }

  async create(userId: string, body: CreateCampaignInput) {
    const campaign = await this.prisma.campaign.create({
      data: {
        userId,
        query: body.query,
        source: toPrismaCampaignSource(body.source),
        config: body.config ?? {},
        createdBy: body.createdBy,
        pilotSearchId: body.pilotSearchId ?? null,
      },
    });
    // A just-created campaign provably has no jobs or messages; skip the aggregate round trip.
    return toCampaignRow(
      campaign,
      campaign.source === "networking" ? emptyNetworkingSummary() : emptyJobSummary(),
    );
  }

  async get(userId: string, id: string) {
    return this.toRow(await this.findCampaign(userId, id));
  }

  async updateConfig(userId: string, id: string, body: UpdateCampaignConfigInput) {
    const existing = await this.findCampaign(userId, id);
    if (!campaignConfigSupportsSource(toWireCampaignSource(existing.source), body.config)) {
      throw unprocessable(
        "config.resumeId is required for search, auto-apply, and networking campaigns.",
      );
    }
    // Whole-blob replace: guarded in the write, since a compare against `existing` leaves a
    // window for the pilot's strategy review and a user edit to clobber each other.
    const updated = await this.prisma.campaign.updateMany({
      where: {
        campaignId: id,
        userId,
        ...(body.expectedUpdatedAt && { updatedAt: new Date(body.expectedUpdatedAt) }),
      },
      data: { config: body.config },
    });
    if (updated.count === 0) {
      throw conflict("Campaign changed since it was fetched; re-fetch before updating config.");
    }
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { campaignId: id } });
    return this.toRow(campaign);
  }

  async commandStatus(userId: string, id: string, body: CampaignStatusCommandInput) {
    const existing = await this.findCampaign(userId, id);
    if (existing.status === body.status) return this.toRow(existing);
    if (!STATUS_TRANSITIONS[existing.status].includes(body.status)) {
      throw conflict(`Campaign cannot transition from ${existing.status} to ${body.status}.`);
    }
    const updated = await this.prisma.campaign.updateMany({
      where: { campaignId: id, userId, status: existing.status },
      data: {
        status: body.status,
        statusActor: body.actor,
        statusReason: body.reason ?? null,
        completedAt: body.status === "completed" || body.status === "failed" ? new Date() : null,
      },
    });
    if (updated.count === 0) throw conflict("Campaign status changed concurrently.");
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { campaignId: id } });
    if (body.status === "completed") {
      publishCampaignCompleted(userId, id);
    } else {
      publish(
        campaignChannel,
        { campaignId: id },
        { type: "status", payload: { status: body.status } },
      );
      publish(
        workspaceChannel,
        { userId },
        {
          type: "campaign.updated",
          campaignId: id,
          status: body.status,
          source: toWireCampaignSource(campaign.source),
        },
      );
    }
    return this.toRow(campaign);
  }

  async remove(userId: string, id: string) {
    await this.ensureCampaignOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const contactIds = (
        await tx.networkingMessage.findMany({
          where: { campaignId: id, userId },
          select: { contactId: true },
        })
      ).map((message) => message.contactId);
      await tx.application.deleteMany({ where: { campaignId: id, userId } });
      await tx.networkingMessage.deleteMany({ where: { campaignId: id, userId } });
      await tx.contact.deleteMany({
        where: { id: { in: contactIds }, userId, messages: { none: {} }, relatedAppId: null },
      });
      await tx.campaign.delete({ where: { campaignId: id } });
    });
    publish(workspaceChannel, { userId }, { type: "campaign.deleted", campaignId: id });
    return { deleted: true, campaignId: id };
  }

  async ensureCampaignOwned(userId: string, campaignId: string): Promise<void> {
    await ensureCampaignOwned(this.prisma, userId, campaignId);
  }

  private findCampaign(userId: string, campaignId: string) {
    return findOwned(
      (where) => this.prisma.campaign.findFirst({ where }),
      { campaignId, userId },
      "Campaign",
    );
  }

  private async toRow(campaign: Campaign) {
    return toCampaignRow(
      campaign,
      await deriveCampaignSummary(this.prisma, campaign.campaignId, campaign.source),
    );
  }
}
