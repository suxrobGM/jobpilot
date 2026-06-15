import type {
  AddCampaignJobInput,
  CampaignConfig,
  CampaignEventInput,
  CampaignJobResultInput,
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
  CampaignSummary,
  CreateCampaignInput,
  PatchCampaignJobInput,
  UpdateCampaignInput,
} from "@jobpilot/contracts/campaign";
import type {
  AddCampaignOutreachInput,
  OutreachChannel,
  OutreachMessageResultInput,
  OutreachMessageStatus,
  PatchOutreachMessageInput,
} from "@jobpilot/contracts/outreach";
import { contactLinkedinConnectionSchema } from "@jobpilot/contracts/outreach";
import { cleanReplacementCharsNullable } from "@jobpilot/contracts/utils/text";
import { singleton } from "tsyringe";
import type { z } from "zod/v4";
import { findOwned, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import { type CampaignEvent, campaignChannel } from "@/common/sse/channels/campaign";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { createContactPayload } from "@/modules/contact";
import { normalizeCompanyName, normalizeJobTitle } from "@/modules/scoring/applied-duplicates";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Contact connection-state union — derived from the contract schema. */
type ContactLinkedinConnection = z.infer<typeof contactLinkedinConnectionSchema>;

// ── Narrowed row shapes ──────────────────────────────────────────────────────
// Prisma stores these enum-like columns as plain `String`. Re-narrow them to the
// contract unions so Eden Treaty infers the precise wire types end-to-end.

/** A Job row with `status` narrowed to the campaign job-status union. */
type CampaignJobRow = Prisma.JobGetPayload<{}> & { status: CampaignJobStatus };

/** A Campaign row with `status`/`source` narrowed and `config`/`summary` typed. */
type CampaignRow = Omit<Prisma.CampaignGetPayload<{}>, "config" | "summary"> & {
  status: CampaignStatus;
  source: CampaignSource;
  config: CampaignConfig;
  summary: CampaignSummary;
};

/**
 * An OutreachMessage row (with its contact) with `status`/`channel` and the nested
 * contact's `linkedinConnection` narrowed to the contract unions.
 */
type OutreachMessageRow = Prisma.OutreachMessageGetPayload<{ include: { contact: true } }> & {
  status: OutreachMessageStatus;
  channel: OutreachChannel;
  contact: { linkedinConnection: ContactLinkedinConnection };
};

function emptySummary(): CampaignSummary {
  return {
    totalFound: 0,
    qualified: 0,
    applied: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    discovered: 0,
    drafted: 0,
    sent: 0,
    replied: 0,
    bounced: 0,
  };
}

function fold(summary: CampaignSummary, status: CampaignJobStatus, n: number): void {
  summary.totalFound += n;

  if (status !== "skipped") {
    summary.qualified += n;
  }
  if (status === "applied") {
    summary.applied += n;
  } else if (status === "failed") {
    summary.failed += n;
  } else if (status === "skipped") {
    summary.skipped += n;
  } else if (status === "approved" || status === "applying") {
    summary.remaining += n;
  }
}

/** Derive a {@link CampaignSummary} from already-loaded job rows. Pure; no I/O. */
function summarizeJobs(jobs: { status: string }[]): CampaignSummary {
  const summary = emptySummary();
  for (const job of jobs) {
    fold(summary, job.status as CampaignJobStatus, 1);
  }
  return summary;
}

@singleton()
export class CampaignService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Summary helpers ────────────────────────────────────────────────────────

  /**
   * Recompute a campaign's {@link CampaignSummary} from its current Job-status
   * aggregates and persist it to `Campaign.summary`. Accepts a transaction client
   * or the bare prisma client.
   */
  private async recomputeCampaignSummary(
    client: Prisma.TransactionClient,
    campaignId: string,
  ): Promise<CampaignSummary> {
    const counts = await client.job.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    });

    const summary = emptySummary();
    for (const row of counts) {
      fold(summary, row.status as CampaignJobStatus, row._count._all);
    }

    await client.campaign.update({
      where: { campaignId },
      data: { summary: JSON.stringify(summary) },
    });

    return summary;
  }

  /**
   * Recompute summary for an outreach campaign (`Campaign.source === "outreach"`)
   * from its OutreachMessage-status aggregates and persist it.
   */
  private async recomputeOutreachSummary(
    client: Prisma.TransactionClient,
    campaignId: string,
  ): Promise<CampaignSummary> {
    const [counts, contacts] = await Promise.all([
      client.outreachMessage.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: { _all: true },
      }),
      client.outreachMessage.findMany({
        where: { campaignId },
        select: { contactId: true },
        distinct: ["contactId"],
      }),
    ]);

    const summary = emptySummary();
    summary.discovered = contacts.length;
    for (const row of counts) {
      const n = row._count._all;
      summary.totalFound += n;
      switch (row.status) {
        case "draft":
        case "approved":
          summary.drafted += n;
          break;
        case "sent":
          summary.sent += n;
          break;
        case "replied":
          summary.replied += n;
          break;
        case "bounced":
          summary.bounced += n;
          break;
      }
    }

    await client.campaign.update({
      where: { campaignId },
      data: { summary: JSON.stringify(summary) },
    });

    return summary;
  }

  // ── Reconcile ───────────────────────────────────────────────────────────────

  /**
   * Flip `in_progress` campaigns whose `updatedAt` is older than the stale
   * threshold to `interrupted`, and revert their `applying` jobs to `approved`
   * so `/resume <campaignId>` can pick them up. Emits SSE per campaign.
   */
  private async reconcileStaleCampaigns(profileId: number): Promise<number> {
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
        pipelineChannel,
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

  async list(profileId: number, query: { status?: string; source?: string }) {
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
      }),
    );
  }

  create(profileId: number, body: CreateCampaignInput) {
    return this.prisma.campaign.create({
      data: {
        campaignId: body.campaignId,
        profileId,
        query: body.query,
        source: body.source,
        config: JSON.stringify(body.config ?? {}),
      },
    }) as Promise<
      Prisma.CampaignGetPayload<{}> & { status: CampaignStatus; source: CampaignSource }
    >;
  }

  // ── Single campaign get / patch / delete ─────────────────────────────────────

  async get(profileId: number, id: string) {
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
      // Clean replacement-char artifacts in historical rows written before the
      // schema-level sanitizer landed, so the UI never shows mojibake.
      jobs: campaign.jobs.map(
        (job): CampaignJobRow => ({
          ...job,
          status: job.status as CampaignJobStatus,
          skipReason: cleanReplacementCharsNullable(job.skipReason),
          failReason: cleanReplacementCharsNullable(job.failReason),
          matchReason: cleanReplacementCharsNullable(job.matchReason),
          retryNotes: cleanReplacementCharsNullable(job.retryNotes),
        }),
      ),
      config: JSON.parse(campaign.config) as CampaignConfig,
      // Job-based campaigns derive the summary from their loaded jobs so the tiles
      // always match the rows; outreach campaigns have no jobs, so their
      // recomputed `Campaign.summary` (OutreachMessage aggregates) is authoritative.
      summary:
        campaign.source === "outreach"
          ? (JSON.parse(campaign.summary) as CampaignSummary)
          : summarizeJobs(campaign.jobs),
    };
  }

  async update(profileId: number, id: string, body: UpdateCampaignInput) {
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
        pipelineChannel,
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
    } satisfies CampaignRow;
  }

  /**
   * Hard-delete a campaign and all of its related data. Prisma only cascades Job
   * and CampaignEvent; Application and OutreachMessage use `onDelete: SetNull`, so
   * they (and campaign-only contacts) are deleted explicitly inside a transaction
   * before the campaign row. Synced EmailMessages are kept (matchedAppId SetNull).
   */
  async remove(profileId: number, id: string) {
    await findOwned(
      (where) => this.prisma.campaign.findFirst({ where }),
      { campaignId: id, profileId },
      "Campaign",
    );

    await this.prisma.$transaction(async (tx) => {
      const contactIds = (
        await tx.outreachMessage.findMany({
          where: { campaignId: id, profileId },
          select: { contactId: true },
        })
      ).map((m) => m.contactId);

      // Cascades StageEvent / ResumeVariant; SetNull on EmailMessage & Contact links.
      await tx.application.deleteMany({ where: { campaignId: id, profileId } });
      await tx.outreachMessage.deleteMany({ where: { campaignId: id, profileId } });

      // Only contacts left with no messages and no related application — i.e. ones
      // that existed solely for this campaign. Skips contacts referenced elsewhere.
      await tx.contact.deleteMany({
        where: { id: { in: contactIds }, profileId, messages: { none: {} }, relatedAppId: null },
      });

      // Cascades Job + CampaignEvent.
      await tx.campaign.delete({ where: { campaignId: id } });
    });

    publish(pipelineChannel, { profileId }, { type: "campaign.deleted", campaignId: id });
    return { deleted: true, campaignId: id };
  }

  // ── Campaign events (SSE record) ─────────────────────────────────────────────

  /** Ownership check used before subscribing to a campaign's SSE feed. */
  async ensureCampaignOwned(profileId: number, campaignId: string): Promise<void> {
    await findOwned(
      (where) => this.prisma.campaign.findFirst({ where, select: { campaignId: true } }),
      { campaignId, profileId },
      "Campaign",
    );
  }

  async recordCampaignEvent(profileId: number, campaignId: string, event: CampaignEventInput) {
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

  // ── Jobs ──────────────────────────────────────────────────────────────────

  listJobs(profileId: number, campaignId: string) {
    return this.prisma.job.findMany({
      where: { campaignId, campaign: { profileId } },
      orderBy: { id: "asc" },
    }) as Promise<CampaignJobRow[]>;
  }

  async addJob(profileId: number, campaignId: string, body: AddCampaignJobInput) {
    await this.ensureCampaignOwned(profileId, campaignId);

    const job = await this.prisma.job.create({
      data: {
        campaignId,
        key: body.key,
        title: body.title,
        company: body.company,
        location: body.location ?? null,
        salary: body.salary ?? null,
        type: body.type ?? null,
        url: body.url,
        board: body.board ?? null,
        matchScore: body.matchScore ?? null,
        matchReason: body.matchReason ?? null,
        status: body.status ?? "pending",
        description: body.description ?? null,
        digest: body.digest ?? null,
      },
    });

    await this.prisma.queueEntry.updateMany({
      where: { profileId, url: job.url, status: "pending" },
      data: { status: "consumed", consumedAt: new Date() },
    });

    publish(
      campaignChannel,
      { campaignId },
      {
        type: "job-update",
        payload: { kind: "added", job },
      },
    );
    publish(
      pipelineChannel,
      { profileId },
      {
        type: "campaignjob.created",
        campaignId,
        key: job.key,
      },
    );

    return job as CampaignJobRow;
  }

  async patchJob(profileId: number, campaignId: string, key: string, patch: PatchCampaignJobInput) {
    await findOwned(
      (where) => this.prisma.job.findFirst({ where, select: { campaignId: true } }),
      { campaignId, key, campaign: { profileId } },
      "Campaign job",
    );

    const job = await this.prisma.job.update({
      where: { campaignId_key: { campaignId, key } },
      data: {
        status: patch.status,
        appliedAt: patch.appliedAt ? new Date(patch.appliedAt) : null,
        failReason: patch.failReason,
        retryNotes: patch.retryNotes,
        skipReason: patch.skipReason,
        matchScore: patch.matchScore,
        matchReason: patch.matchReason,
        description: patch.description,
        digest: patch.digest,
      },
    });

    if (job.status === "applied" || job.status === "failed" || job.status === "skipped") {
      const queueStatus = job.status === "skipped" ? "skipped" : "consumed";
      await this.prisma.queueEntry.updateMany({
        where: { profileId, url: job.url, status: "pending" },
        data: {
          status: queueStatus,
          consumedAt: queueStatus === "consumed" ? new Date() : null,
        },
      });
    }

    publish(
      campaignChannel,
      { campaignId },
      { type: "job-update", payload: { kind: "updated", job } },
    );

    if (patch.status) {
      const summary = await this.recomputeCampaignSummary(this.prisma, campaignId);
      publish(campaignChannel, { campaignId }, { type: "progress", payload: summary });
    }

    publish(
      pipelineChannel,
      { profileId },
      { type: "campaignjob.updated", campaignId, key, status: patch.status },
    );

    return job as CampaignJobRow;
  }

  /**
   * Terminal-outcome handoff for a Job. Atomically updates Job status, upserts the
   * Application row (when `applied`), marks the QueueEntry consumed/skipped, and
   * recomputes Campaign.summary from the post-update Job aggregates.
   */
  async recordJobResult(
    profileId: number,
    campaignId: string,
    key: string,
    data: CampaignJobResultInput,
  ) {
    const existing = await findOwned(
      (where) =>
        this.prisma.job.findFirst({
          where,
          include: { campaign: { select: { source: true, summary: true } } },
        }),
      { campaignId, key, campaign: { profileId } },
      "Campaign job",
    );

    const appliedAt = data.outcome === "applied" ? new Date(data.appliedAt as string) : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const job = await tx.job.update({
        where: { campaignId_key: { campaignId, key } },
        data: {
          status: data.outcome,
          appliedAt: data.outcome === "applied" ? appliedAt : null,
          failReason: data.outcome === "failed" ? data.failReason : null,
          skipReason: data.outcome === "skipped" ? data.skipReason : null,
          retryNotes: data.retryNotes,
          matchScore: data.matchScore,
        },
      });

      let application = null;
      let applicationCreated = false;

      if (data.outcome === "applied") {
        const found = await tx.application.findUnique({
          where: { profileId_url: { profileId, url: job.url } },
        });

        if (found) {
          application = found;
        } else {
          application = await tx.application.create({
            data: {
              profileId,
              url: job.url,
              title: job.title,
              company: job.company,
              location: job.location,
              board: job.board,
              source: existing.campaign.source as string,
              campaignId,
              matchScore: job.matchScore,
              matchReason: job.matchReason,
              normalizedTitle: normalizeJobTitle(job.title),
              normalizedCompany: normalizeCompanyName(job.company),
              appliedAt: appliedAt!,
              stageEvents: { create: { fromStage: null, toStage: "applied" } },
            },
          });
          applicationCreated = true;
        }
      }

      const queueStatus = data.outcome === "skipped" ? "skipped" : "consumed";
      await tx.queueEntry.updateMany({
        where: { profileId, url: job.url, status: "pending" },
        data: {
          status: queueStatus,
          consumedAt: queueStatus === "consumed" ? new Date() : null,
        },
      });

      const summary = await this.recomputeCampaignSummary(tx, campaignId);

      return { job, application, applicationCreated, summary };
    });

    publish(
      campaignChannel,
      { campaignId },
      { type: "job-update", payload: { kind: "updated", job: result.job } },
    );
    publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
    publish(
      pipelineChannel,
      { profileId },
      { type: "campaignjob.updated", campaignId, key, status: data.outcome },
    );
    if (result.applicationCreated) {
      publish(pipelineChannel, { profileId }, { type: "application.created", campaignId });
    }

    return {
      campaignJob: result.job as CampaignJobRow,
      application: result.application,
      summary: result.summary,
    };
  }

  // ── Outreach ────────────────────────────────────────────────────────────────

  /** List the campaign's outreach messages (with their contacts) for the board. */
  listOutreach(profileId: number, campaignId: string) {
    return this.prisma.outreachMessage.findMany({
      where: { campaignId, profileId },
      include: { contact: true },
      orderBy: { id: "asc" },
    }) as Promise<OutreachMessageRow[]>;
  }

  /**
   * Add a discovered contact (or attach to an existing `contactId`) plus an
   * initial draft message to the campaign, then recompute the campaign summary.
   */
  async addOutreach(profileId: number, campaignId: string, body: AddCampaignOutreachInput) {
    await this.ensureCampaignOwned(profileId, campaignId);

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

      const summary = await this.recomputeOutreachSummary(tx, campaignId);
      return { outreachMessage, summary };
    });

    if (!result) {
      throw notFound("Contact not found");
    }

    // Push the new contact/message to the live campaign viewer.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return result.outreachMessage as OutreachMessageRow;
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
        await this.recomputeOutreachSummary(tx, campaignId);
      }
      return message;
    });

    // Refresh the live campaign board (e.g. a regenerated draft) without a reload.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return updated as OutreachMessageRow;
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
      const summary = await this.recomputeOutreachSummary(tx, campaignId);
      return { message, summary };
    });

    // Refresh the live campaign viewer on the terminal outcome.
    publish(campaignChannel, { campaignId }, { type: "outreach-update" });
    return { message: result.message as OutreachMessageRow, summary: result.summary };
  }
}
