import {
  type CampaignStatusCommandInput,
  type CreateCampaignInput,
  campaignConfigSchema,
  campaignConfigSupportsSource,
  type UpdateCampaignConfigInput,
} from "@jobpilot/contracts/campaign";
import { ErrorCodes } from "@jobpilot/contracts/errors";
import { pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import type { z } from "zod/v4";
import { conflict, findOwned, unprocessable } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import { normalizeJobUrl } from "@/common/utils/url";
import { type CampaignStatus, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { BOARD_REF_SELECT, JobBoardService } from "@/modules/job-board/job-board.service";
import type { campaignsQuery } from "./campaign.schema";
import {
  deriveCampaignSummary,
  emptySummary,
  jobSummary,
  summarizeCampaigns,
  type WithSummary,
} from "./campaign.summary";
import { ensureCampaignOwned, publishCampaignStatus } from "./campaign.utils";

const STATUS_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  in_progress: ["paused", "completed", "failed"],
  paused: ["in_progress", "completed", "failed"],
  completed: [],
  failed: [],
};

const CAMPAIGN_INCLUDE = { board: { select: BOARD_REF_SELECT } } satisfies Prisma.CampaignInclude;

type CampaignRow = Prisma.CampaignGetPayload<{ include: typeof CAMPAIGN_INCLUDE }>;

function toRow(campaign: WithSummary<CampaignRow>) {
  return { ...campaign, config: campaignConfigSchema.parse(campaign.config) };
}

@injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly boards = inject(JobBoardService),
  ) {}

  async list(userId: string, query: z.infer<typeof campaignsQuery>) {
    const where: Prisma.CampaignWhereInput = {
      userId,
      status: query.status?.length ? { in: query.status } : undefined,
      source: query.source,
      jobs: query.jobStatus ? { some: { status: query.jobStatus } } : undefined,
    };
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        include: CAMPAIGN_INCLUDE,
        orderBy: { startedAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.campaign.count({ where }),
    ]);
    const rows = await summarizeCampaigns(this.prisma, campaigns);
    return paginate(rows.map(toRow), query, total);
  }

  async create(userId: string, body: CreateCampaignInput) {
    const data: Prisma.CampaignUncheckedCreateInput = {
      userId,
      query: body.query,
      source: body.source,
      boardId: await this.boards.resolveId(body.board ?? null),
      config: toInputJson(body.config ?? {}),
      createdBy: body.createdBy,
      pilotSearchId: body.pilotSearchId ?? null,
    };
    if (body.urls) {
      return this.createWithQueuedJobs(data, body.urls);
    }

    const campaign = await this.prisma.campaign.create({ data, include: CAMPAIGN_INCLUDE });
    // A just-created campaign provably has no jobs or messages; skip the aggregate round trip.
    return toRow({ ...campaign, summary: emptySummary(campaign.source) });
  }

  /** Seeds pasted links as `queued` jobs with the campaign, so a half-written batch can't strand them. */
  private async createWithQueuedJobs(data: Prisma.CampaignUncheckedCreateInput, urls: string[]) {
    const unique = [...new Set(urls.map(normalizeJobUrl))];
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({ data, include: CAMPAIGN_INCLUDE });
      await tx.campaignJob.createMany({
        data: unique.map((url) => ({
          userId: created.userId,
          campaignId: created.id,
          key: crypto.randomUUID(),
          // Nothing is known about a pasted link until a worker opens it; the host stands in.
          title: new URL(url).hostname,
          company: "",
          url,
          status: "queued" as const,
        })),
      });
      return created;
    });
    return toRow({
      ...campaign,
      summary: jobSummary([{ status: "queued", count: unique.length }]),
    });
  }

  async get(userId: string, id: string) {
    return this.withSummary(await this.findCampaign(userId, id));
  }

  async updateConfig(userId: string, id: string, body: UpdateCampaignConfigInput) {
    const existing = await this.findCampaign(userId, id);
    if (!campaignConfigSupportsSource(existing.source, body.config)) {
      throw unprocessable(
        "config.resumeId is required for search, auto-apply, and networking campaigns.",
      );
    }
    // Guarded in the write: comparing against `existing` leaves a window for the pilot's campaign
    // tune and a user edit to clobber each other.
    const updated = await this.prisma.campaign.updateMany({
      where: {
        id,
        userId,
        ...(body.expectedUpdatedAt && { updatedAt: new Date(body.expectedUpdatedAt) }),
      },
      data: { config: toInputJson(body.config) },
    });
    if (updated.count === 0) {
      throw conflict(
        "Campaign changed since it was fetched; re-fetch before updating config.",
        ErrorCodes.STALE_WRITE,
      );
    }
    return this.withSummary(
      await this.prisma.campaign.findUniqueOrThrow({ where: { id }, include: CAMPAIGN_INCLUDE }),
    );
  }

  async commandStatus(userId: string, id: string, body: CampaignStatusCommandInput) {
    const existing = await this.findCampaign(userId, id);
    if (existing.status === body.status) {
      return this.withSummary(existing);
    }
    if (!STATUS_TRANSITIONS[existing.status].includes(body.status)) {
      throw conflict(`Campaign cannot transition from ${existing.status} to ${body.status}.`);
    }
    const finished = body.status === "completed" || body.status === "failed";
    const updated = await this.prisma.campaign.updateMany({
      where: { id, userId, status: existing.status },
      data: {
        status: body.status,
        statusActor: body.actor,
        statusReason: body.reason ?? null,
        completedAt: finished ? new Date() : null,
      },
    });
    if (updated.count === 0) {
      throw conflict("Campaign status changed concurrently.", ErrorCodes.STALE_WRITE);
    }
    publishCampaignStatus(userId, existing, body.status);
    return this.withSummary(
      await this.prisma.campaign.findUniqueOrThrow({ where: { id }, include: CAMPAIGN_INCLUDE }),
    );
  }

  async remove(userId: string, id: string) {
    await ensureCampaignOwned(this.prisma, userId, id);
    await this.prisma.$transaction(async (tx) => {
      const messages = await tx.networkingMessage.findMany({
        where: { campaignId: id, userId },
        select: { contactId: true },
      });
      await tx.application.deleteMany({ where: { campaignId: id, userId } });
      await tx.networkingMessage.deleteMany({ where: { campaignId: id, userId } });
      await tx.contact.deleteMany({
        where: {
          id: { in: messages.map((message) => message.contactId) },
          userId,
          messages: { none: {} },
          relatedAppId: null,
        },
      });
      await tx.campaign.delete({ where: { id } });
    });
    publish(workspaceChannel, { userId }, { type: "campaign.deleted", campaignId: id });
    return { deleted: id };
  }

  findCampaign(userId: string, campaignId: string) {
    return findOwned(
      (where) => this.prisma.campaign.findFirst({ where, include: CAMPAIGN_INCLUDE }),
      { id: campaignId, userId },
      "Campaign",
    );
  }

  private async withSummary(campaign: CampaignRow) {
    const summary = await deriveCampaignSummary(this.prisma, campaign.id, campaign.source);
    return toRow({ ...campaign, summary });
  }
}
