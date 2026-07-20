import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  CampaignJobStatus,
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { type Job, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { JobListingIngestService } from "@/modules/job-listing";
import { createPaginatedResponse } from "@/types/response";
import { deriveCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";
import { writeJobRescan, writeJobRetry } from "./job-commands";
import { isTerminalJob, writeJobResult } from "./job-result";

const ALLOWED_TRANSITIONS: Record<CampaignJobStatus, readonly CampaignJobStatus[]> = {
  pending: ["approved"],
  approved: ["pending", "applying"],
  applying: ["approved", "needs_user"],
  needs_user: ["approved", "applying"],
  applied: [],
  failed: [],
  skipped: [],
};

type JobTransaction = Pick<Prisma.TransactionClient, "job">;

export interface ScoredJobPromotion {
  key: string;
  matchScore: number;
  threshold: number;
}

/** Coordinates campaign job discovery, non-terminal edits, claims, and terminal results. */
@singleton()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listings: JobListingIngestService,
  ) {}

  async listJobs(userId: string, campaignId: string, query: { page: number; limit: number }) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);
    const where = { campaignId, campaign: { userId } };
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.job.count({ where }),
    ]);
    return createPaginatedResponse(jobs, { ...query, total });
  }

  async addJob(userId: string, campaignId: string, body: AddCampaignJobInput) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
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
      await tx.queueEntry.updateMany({
        where: { userId, url: created.url, status: "pending" },
        data: { status: "consumed", consumedAt: new Date() },
      });
      return created;
    });
    this.listings.ingestInBackground(job);
    this.publishJob(userId, campaignId, job, "added");
    return job;
  }

  async patchJob(userId: string, campaignId: string, key: string, patch: PatchCampaignJobInput) {
    const existing = await findOwned(
      (where) => this.prisma.job.findFirst({ where }),
      { campaignId, key, campaign: { userId } },
      "Campaign job",
    );
    if (isTerminalJob(existing.status)) {
      throw conflict("Terminal jobs cannot be edited; use the retry or rescan command.");
    }
    if (patch.status && patch.status !== existing.status) {
      if (!ALLOWED_TRANSITIONS[existing.status].includes(patch.status)) {
        throw conflict(`Job cannot transition from ${existing.status} to ${patch.status}.`);
      }
    }
    const job = await this.prisma.$transaction(async (tx) => {
      if (patch.status && patch.status !== existing.status) {
        const changed = await tx.job.updateMany({
          where: { campaignId, key, status: existing.status },
          data: {
            status: patch.status,
            appliedAt: patch.status === "approved" ? null : undefined,
            failReason: patch.status === "approved" ? null : undefined,
            skipReason: patch.status === "approved" ? null : undefined,
          },
        });
        if (changed.count === 0) throw conflict("Job status changed concurrently.");
      }
      return tx.job.update({
        where: { campaignId_key: { campaignId, key } },
        data: {
          retryNotes: patch.retryNotes,
          matchScore: patch.matchScore,
          matchReason: patch.matchReason,
          description: patch.description,
          digest: patch.digest,
        },
      });
    });
    this.listings.ingestInBackground(job);
    this.publishJob(userId, campaignId, job, "updated");
    return job;
  }

  async retryJob(userId: string, campaignId: string, key: string, body: RetryCampaignJobInput) {
    const result = await writeJobRetry(this.prisma, userId, campaignId, key, body);
    if (result.changed) this.publishJob(userId, campaignId, result.job, "updated");
    return result.job;
  }

  async rescanJob(userId: string, campaignId: string, key: string, body: RescanCampaignJobInput) {
    const result = await writeJobRescan(this.prisma, userId, campaignId, key, body);
    if (result.changed) this.publishJob(userId, campaignId, result.job, "updated");
    return result.job;
  }

  async claimJobForApplyInTransaction(
    tx: JobTransaction,
    userId: string,
    campaignId: string,
    key: string,
  ): Promise<Job> {
    const claim = await tx.job.updateMany({
      where: { campaignId, key, status: "approved", campaign: { userId } },
      data: { status: "applying" },
    });
    if (claim.count === 0) throw conflict("Job is no longer approved.");
    return tx.job.findUniqueOrThrow({ where: { campaignId_key: { campaignId, key } } });
  }

  async claimJobForApply(userId: string, campaignId: string, key: string) {
    const job = await this.prisma.$transaction((tx) =>
      this.claimJobForApplyInTransaction(tx, userId, campaignId, key),
    );
    this.publishJob(userId, campaignId, job, "updated");
    return job;
  }

  publishClaimedJob(userId: string, campaignId: string, job: Job): void {
    this.publishJob(userId, campaignId, job, "updated");
  }

  async promoteScoredJobs(
    userId: string,
    campaignId: string,
    candidates: ScoredJobPromotion[],
  ): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const jobs: Job[] = [];
      for (const candidate of candidates) {
        const approved = candidate.matchScore >= candidate.threshold;
        const changed = await tx.job.updateMany({
          where: {
            campaignId,
            key: candidate.key,
            status: "pending",
            matchScore: candidate.matchScore,
            campaign: { userId, status: "in_progress", source: "auto_apply" },
          },
          data: approved
            ? { status: "approved" }
            : {
                status: "skipped",
                skipReason: `Below minimum match score (${candidate.matchScore} < ${candidate.threshold})`,
              },
        });
        if (changed.count === 0) continue;
        const job = await tx.job.findUniqueOrThrow({
          where: { campaignId_key: { campaignId, key: candidate.key } },
        });
        jobs.push(job);
        if (!approved) {
          await tx.queueEntry.updateMany({
            where: { userId, url: job.url, status: "pending" },
            data: { status: "skipped", consumedAt: null },
          });
        }
      }
      return {
        jobs,
        summary: await deriveCampaignSummary(tx, campaignId, "auto_apply"),
      };
    });
    if (result.jobs.length === 0) return;
    for (const job of result.jobs) this.publishJob(userId, campaignId, job, "updated");
    publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
  }

  async recordJobResult(
    userId: string,
    campaignId: string,
    key: string,
    data: CampaignJobResultInput,
  ) {
    const result = await writeJobResult(this.prisma, userId, campaignId, key, data);
    if (result.changed) {
      this.publishJob(userId, campaignId, result.campaignJob, "updated");
      if (result.application) {
        publish(workspaceChannel, { userId }, { type: "application.created", campaignId });
      }
      publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
    }
    return {
      campaignJob: result.campaignJob,
      application: result.application,
      summary: result.summary,
    };
  }

  private publishJob(userId: string, campaignId: string, job: Job, kind: "added" | "updated") {
    publish(campaignChannel, { campaignId }, { type: "job-update", payload: { kind, job } });
    publish(
      workspaceChannel,
      { userId },
      {
        type: kind === "added" ? "campaignjob.created" : "campaignjob.updated",
        campaignId,
        key: job.key,
        ...(kind === "updated" ? { status: job.status } : {}),
      },
    );
  }
}
