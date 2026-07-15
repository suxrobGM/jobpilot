import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  CampaignJobStatus,
  CampaignSummary,
  PatchCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { type Job, PrismaClient } from "@/generated/prisma/client";
import { JobListingIngestService } from "@/modules/job-listing";
import { normalizeCompanyName, normalizeJobTitle } from "@/modules/scoring/applied-duplicates";
import { type CampaignJobRow, toCampaignJobRow } from "../campaign.mapper";
import { recomputeCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";

@singleton()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listings: JobListingIngestService,
  ) {}

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
        failReason: body.failReason ?? null,
        skipReason: body.skipReason ?? null,
        description: body.description ?? null,
        digest: body.digest ?? null,
      },
    });

    await this.prisma.queueEntry.updateMany({
      where: { profileId, url: job.url, status: "pending" },
      data: { status: "consumed", consumedAt: new Date() },
    });

    this.listings.ingestInBackground(job);

    publish(
      campaignChannel,
      { campaignId },
      {
        type: "job-update",
        payload: { kind: "added", job },
      },
    );
    publish(
      workspaceChannel,
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

    // The digest usually lands on a PATCH, not the POST - the agent scores from a results row and
    // enriches after opening the posting. This is the call that populates most listings. Gating on
    // the digest is the ingest's own job; duplicating that policy here would silently diverge.
    this.listings.ingestInBackground(job);

    return this.emitJobUpdate(profileId, campaignId, key, job, patch.status);
  }

  /**
   * Single-writer claim: atomically flip an approved job to applying so only one Pilot
   * lease can take it. Conflicts (409) when the row is no longer approved (lost the race).
   * Emits through patchJob's shared path so a claim looks identical to a manual status change.
   */
  async claimJobForApply(
    profileId: string,
    campaignId: string,
    key: string,
  ): Promise<CampaignJobRow> {
    const claim = await this.prisma.job.updateMany({
      where: { campaignId, key, status: "approved", campaign: { profileId } },
      data: { status: "applying" },
    });
    if (claim.count === 0) {
      throw conflict("Job is no longer approved.");
    }
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { campaignId_key: { campaignId, key } },
    });
    return this.emitJobUpdate(profileId, campaignId, key, job, "applying");
  }

  /**
   * Post-update SSE + summary recompute shared by every job-status writer.
   * Pass `summary` to reuse a transaction-computed one instead of re-querying.
   */
  private async emitJobUpdate(
    profileId: string,
    campaignId: string,
    key: string,
    job: Job,
    status?: CampaignJobStatus,
    summary?: CampaignSummary,
  ): Promise<CampaignJobRow> {
    publish(
      campaignChannel,
      { campaignId },
      { type: "job-update", payload: { kind: "updated", job } },
    );

    if (status) {
      const progress = summary ?? (await recomputeCampaignSummary(this.prisma, campaignId));
      publish(campaignChannel, { campaignId }, { type: "progress", payload: progress });
    }

    publish(
      workspaceChannel,
      { profileId },
      { type: "campaignjob.updated", campaignId, key, status },
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
              events: {
                create: { kind: "status_change", toStatus: "applied", source: "campaign" },
              },
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

    const campaignJob = await this.emitJobUpdate(
      profileId,
      campaignId,
      key,
      result.job,
      data.outcome,
      result.summary,
    );
    if (result.applicationCreated) {
      publish(workspaceChannel, { profileId }, { type: "application.created", campaignId });
    }

    return {
      campaignJob,
      application: result.application,
      summary: result.summary,
    };
  }
}
