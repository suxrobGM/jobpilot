import type {
  CampaignConfig,
  CampaignEventInput,
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
  CampaignSummary,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@jobpilot/contracts/campaign";
import { type CampaignEvent, campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { cleanReplacementCharsNullable } from "@jobpilot/contracts/utils/text";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { type Campaign, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { type CampaignJobRow, type CampaignRow } from "./campaign.mapper";
import { summarizeJobs } from "./campaign.summary";
import { ensureCampaignOwned } from "./campaign.utils";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

@singleton()
export class CampaignService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Reconcile ───────────────────────────────────────────────────────────────

  /**
   * Flip `in_progress` campaigns whose `updatedAt` is older than the stale
   * threshold to `interrupted`, and revert their `applying` jobs to `approved`
   * so `/resume <campaignId>` can pick them up. Emits SSE per campaign.
   */
  private async reconcileStaleCampaigns(profileId: string): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

    const stale = await this.prisma.campaign.findMany({
      where: {
        profileId,
        status: "in_progress",
        updatedAt: { lt: cutoff },
      },
      select: { campaignId: true, source: true },
    });

    if (stale.length === 0) {
      return 0;
    }

    await this.prisma.$transaction([
      this.prisma.campaign.updateMany({
        where: { campaignId: { in: stale.map((r) => r.campaignId) } },
        data: { status: "interrupted" },
      }),
      this.prisma.job.updateMany({
        where: { campaignId: { in: stale.map((r) => r.campaignId) }, status: "applying" },
        data: { status: "approved" },
      }),
    ]);

    for (const r of stale) {
      publish(
        campaignChannel,
        { campaignId: r.campaignId },
        { type: "status", payload: { status: "interrupted" } },
      );
      publish(
        workspaceChannel,
        { profileId },
        {
          type: "campaign.updated",
          campaignId: r.campaignId,
          status: "interrupted",
          source: r.source,
        },
      );
    }

    return stale.length;
  }

  // ── Campaign list / create ───────────────────────────────────────────────────

  async list(profileId: string, query: { status?: string; source?: string }) {
    await this.reconcileStaleCampaigns(profileId);

    const where: Prisma.CampaignWhereInput = { profileId };

    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;

    const campaigns = await this.prisma.campaign.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 200,
    });

    return campaigns.map(
      (r): CampaignRow => ({
        ...r,
        status: r.status as CampaignStatus,
        source: r.source as CampaignSource,
        config: JSON.parse(r.config) as CampaignConfig,
        summary: JSON.parse(r.summary) as CampaignSummary,
        startedAt: r.startedAt,
        updatedAt: r.updatedAt,
        completedAt: r.completedAt,
      }),
    );
  }

  async create(profileId: string, body: CreateCampaignInput) {
    const campaign = await this.prisma.campaign.create({
      data: {
        campaignId: body.campaignId,
        profileId,
        query: body.query,
        source: body.source,
        config: JSON.stringify(body.config ?? {}),
      },
    });

    return {
      ...campaign,
      status: campaign.status as CampaignStatus,
      source: campaign.source as CampaignSource,
      startedAt: campaign.startedAt,
      updatedAt: campaign.updatedAt,
      completedAt: campaign.completedAt,
    } satisfies Omit<Campaign, "startedAt" | "updatedAt" | "completedAt"> & {
      status: CampaignStatus;
      source: CampaignSource;
      startedAt: Date;
      updatedAt: Date;
      completedAt: Date | null;
    };
  }

  // ── Single campaign get / patch / delete ─────────────────────────────────────

  async get(profileId: string, id: string) {
    await this.reconcileStaleCampaigns(profileId);

    const campaign = await findOwned(
      (where) =>
        this.prisma.campaign.findFirst({
          where,
          include: { jobs: { orderBy: { id: "asc" } } },
        }),
      { campaignId: id, profileId },
      "Campaign",
    );

    return {
      ...campaign,
      status: campaign.status as CampaignStatus,
      source: campaign.source as CampaignSource,
      startedAt: campaign.startedAt,
      updatedAt: campaign.updatedAt,
      completedAt: campaign.completedAt,
      // Clean replacement-char artifacts in historical rows written before the
      // schema-level sanitizer landed, so the UI never shows mojibake.
      jobs: campaign.jobs.map(
        (job): CampaignJobRow => ({
          ...job,
          status: job.status as CampaignJobStatus,
          appliedAt: job.appliedAt,
          skipReason: cleanReplacementCharsNullable(job.skipReason),
          failReason: cleanReplacementCharsNullable(job.failReason),
          matchReason: cleanReplacementCharsNullable(job.matchReason),
          retryNotes: cleanReplacementCharsNullable(job.retryNotes),
        }),
      ),
      config: JSON.parse(campaign.config) as CampaignConfig,
      // Job-based campaigns derive the summary from their loaded jobs so the tiles
      // always match the rows; networking campaigns have no jobs, so their
      // recomputed `Campaign.summary` (NetworkingMessage aggregates) is authoritative.
      summary:
        campaign.source === "networking"
          ? (JSON.parse(campaign.summary) as CampaignSummary)
          : summarizeJobs(campaign.jobs),
    };
  }

  async update(profileId: string, id: string, body: UpdateCampaignInput) {
    const existing = await findOwned(
      (where) => this.prisma.campaign.findFirst({ where }),
      { campaignId: id, profileId },
      "Campaign",
    );

    const update: Prisma.CampaignUpdateInput = { status: body.status };

    if (body.summary) {
      update.summary = JSON.stringify({ ...JSON.parse(existing.summary), ...body.summary });
    }
    if (body.config) {
      update.config = JSON.stringify({ ...JSON.parse(existing.config), ...body.config });
    }
    if (body.completedAt !== undefined) {
      update.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    }

    const campaign = await this.prisma.campaign.update({
      where: { campaignId: id },
      data: update,
    });

    if (body.status) {
      publish(
        campaignChannel,
        { campaignId: id },
        {
          type: "status",
          payload: { status: body.status },
        },
      );
      publish(
        workspaceChannel,
        { profileId },
        body.status === "completed"
          ? { type: "campaign.completed", campaignId: id }
          : {
              type: "campaign.updated",
              campaignId: id,
              status: body.status,
              source: existing.source,
            },
      );
    }
    if (body.summary) {
      publish(
        campaignChannel,
        { campaignId: id },
        { type: "progress", payload: JSON.parse(campaign.summary) },
      );
    }

    return {
      ...campaign,
      status: campaign.status as CampaignStatus,
      source: campaign.source as CampaignSource,
      config: JSON.parse(campaign.config) as CampaignConfig,
      summary: JSON.parse(campaign.summary) as CampaignSummary,
      startedAt: campaign.startedAt,
      updatedAt: campaign.updatedAt,
      completedAt: campaign.completedAt,
    } satisfies CampaignRow;
  }

  /**
   * Hard-delete a campaign and all of its related data. Prisma only cascades Job
   * and CampaignEvent; Application and NetworkingMessage use `onDelete: SetNull`, so
   * they (and campaign-only contacts) are deleted explicitly inside a transaction
   * before the campaign row. Synced EmailMessages are kept (matchedAppId SetNull).
   */
  async remove(profileId: string, id: string) {
    await findOwned(
      (where) => this.prisma.campaign.findFirst({ where }),
      { campaignId: id, profileId },
      "Campaign",
    );

    await this.prisma.$transaction(async (tx) => {
      const contactIds = (
        await tx.networkingMessage.findMany({
          where: { campaignId: id, profileId },
          select: { contactId: true },
        })
      ).map((m) => m.contactId);

      // Cascades ApplicationEvent / ResumeVariant; SetNull on EmailMessage & Contact links.
      await tx.application.deleteMany({ where: { campaignId: id, profileId } });
      await tx.networkingMessage.deleteMany({ where: { campaignId: id, profileId } });

      // Only contacts left with no messages and no related application - i.e. ones
      // that existed solely for this campaign. Skips contacts referenced elsewhere.
      await tx.contact.deleteMany({
        where: { id: { in: contactIds }, profileId, messages: { none: {} }, relatedAppId: null },
      });

      // Cascades Job + CampaignEvent.
      await tx.campaign.delete({ where: { campaignId: id } });
    });

    publish(workspaceChannel, { profileId }, { type: "campaign.deleted", campaignId: id });
    return { deleted: true, campaignId: id };
  }

  // ── Campaign events (SSE record) ─────────────────────────────────────────────

  /** Ownership check used before subscribing to a campaign's SSE feed. */
  ensureCampaignOwned(profileId: string, campaignId: string): Promise<void> {
    return ensureCampaignOwned(this.prisma, profileId, campaignId);
  }

  async recordCampaignEvent(profileId: string, campaignId: string, event: CampaignEventInput) {
    await this.ensureCampaignOwned(profileId, campaignId);

    const created = await this.prisma.campaignEvent.create({
      data: { campaignId, type: event.type, payload: JSON.stringify(event.payload) },
    });
    publish(campaignChannel, { campaignId }, {
      type: event.type,
      payload: event.payload,
    } as CampaignEvent);
    return { id: created.id };
  }
}
