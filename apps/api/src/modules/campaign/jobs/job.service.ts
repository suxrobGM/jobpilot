import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  PatchCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { campaignChannel } from "@/common/sse/channels/campaign";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { PrismaClient } from "@/generated/prisma/client";
import { normalizeCompanyName, normalizeJobTitle } from "@/modules/scoring/applied-duplicates";
import { toCampaignJobRow } from "../campaign.mapper";
import { recomputeCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

@singleton()
export class CampaignJobService {
  constructor(private readonly prisma: PrismaClient) {}

  async listJobs(profileId: string, campaignId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { campaignId, campaign: { profileId } },
      orderBy: { id: "asc" },
    });
    return jobs.map(toCampaignJobRow);
  }

  async addJob(profileId: string, campaignId: string, body: AddCampaignJobInput) {
    await ensureCampaignOwned(this.prisma, profileId, campaignId);

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

    return toCampaignJobRow(job);
  }

  async patchJob(profileId: string, campaignId: string, key: string, patch: PatchCampaignJobInput) {
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
      const summary = await recomputeCampaignSummary(this.prisma, campaignId);
      publish(campaignChannel, { campaignId }, { type: "progress", payload: summary });
    }

    publish(
      pipelineChannel,
      { profileId },
      { type: "campaignjob.updated", campaignId, key, status: patch.status },
    );

    return toCampaignJobRow(job);
  }

  /**
   * Terminal-outcome handoff for a Job. Atomically updates Job status, upserts the
   * Application row (when `applied`), marks the QueueEntry consumed/skipped, and
   * recomputes Campaign.summary from the post-update Job aggregates.
   */
  async recordJobResult(
    profileId: string,
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

      const summary = await recomputeCampaignSummary(tx, campaignId);

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
      campaignJob: toCampaignJobRow(result.job),
      application: result.application,
      summary: result.summary,
    };
  }
}
