import type {
  AddCampaignJobInput,
  CampaignJobResultInput,
  CampaignSummary,
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type CampaignSource,
  type Job,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { duplicateSkipReason } from "@/modules/application/duplicate";
import { JobListingPublisher } from "@/modules/job-listing";
import { ensureCampaignOwned } from "../campaign.utils";
import { AlreadyAppliedError, assertNotAlreadyApplied } from "./applied-guard";
import { writeJobPatch, writeJobRescan, writeJobRetry } from "./job-commands";
import { type ScoredJobPromotion, writeScoredPromotions } from "./job-promotion";
import { type JobListQuery, listCampaignJobReasons, listCampaignJobs } from "./job-queries";
import { writeJobResult } from "./job-result";

/** The pilot claims inside its own transaction, so the claim takes a client rather than opening one. */
type JobTransaction = Pick<Prisma.TransactionClient, "job" | "application">;

/**
 * Coordinates campaign job reads, writes, claims and results. Every write algorithm lives in a
 * sibling `job-*` module; what stays here is the DI wiring and the SSE publishing that follows.
 */
@singleton()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listings: JobListingPublisher,
  ) {}

  listJobs(userId: string, campaignId: string, query: JobListQuery) {
    return listCampaignJobs(this.prisma, userId, campaignId, query);
  }

  listJobReasons(userId: string, campaignId: string) {
    return listCampaignJobReasons(this.prisma, userId, campaignId);
  }

  async addJob(userId: string, campaignId: string, body: AddCampaignJobInput) {
    await ensureCampaignOwned(this.prisma, userId, campaignId);

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

    this.listings.publishInBackground(job);
    this.publishJob(userId, campaignId, job, "added");
    return job;
  }

  async patchJob(userId: string, campaignId: string, key: string, patch: PatchCampaignJobInput) {
    const result = await this.skippingDuplicates(userId, () =>
      writeJobPatch(this.prisma, userId, campaignId, key, patch),
    );

    this.listings.publishInBackground(result.job);
    this.publishStatusChange(userId, campaignId, result);
    return result.job;
  }

  async retryJob(userId: string, campaignId: string, key: string, body: RetryCampaignJobInput) {
    const result = await writeJobRetry(this.prisma, userId, campaignId, key, body);
    this.publishStatusChange(userId, campaignId, result);
    return result.job;
  }

  async rescanJob(userId: string, campaignId: string, key: string, body: RescanCampaignJobInput) {
    const result = await writeJobRescan(this.prisma, userId, campaignId, key, body);
    // A rescan opens the posting, so it is often the first write carrying a publishable digest.
    if (result.changed) {
      this.listings.publishInBackground(result.job);
    }

    this.publishStatusChange(userId, campaignId, result);
    return result.job;
  }

  /** Moves an approved job into `applying`, refusing a posting this profile already applied to. */
  async claimJobForApplyInTransaction(
    tx: JobTransaction,
    userId: string,
    campaignId: string,
    key: string,
  ): Promise<Job> {
    const where = {
      campaignId,
      key,
      status: "approved",
      campaign: { userId },
    } satisfies Prisma.JobWhereInput;

    const target = await tx.job.findFirst({
      where,
      select: { url: true, title: true, company: true },
    });
    if (!target) throw conflict("Job is no longer approved.");
    await assertNotAlreadyApplied(tx, userId, { ...target, campaignId, key });

    // Returning the row from the write keeps the claim at two round trips; an empty result is the
    // lost race.
    const [claimed] = await tx.job.updateManyAndReturn({ where, data: { status: "applying" } });
    if (!claimed) throw conflict("Job is no longer approved.");
    return claimed;
  }

  async claimJobForApply(userId: string, campaignId: string, key: string) {
    const job = await this.skippingDuplicates(userId, () =>
      this.prisma.$transaction((tx) =>
        this.claimJobForApplyInTransaction(tx, userId, campaignId, key),
      ),
    );
    this.publishJob(userId, campaignId, job, "updated");
    return job;
  }

  /**
   * Records the job `skipped` when the duplicate guard refuses a transition into `applying`. The
   * refusal rolls `work`'s transaction back, so the skip needs a write of its own: a job left
   * `approved` is offered again by every following agenda, ahead of the jobs below it.
   */
  async skippingDuplicates<T>(userId: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AlreadyAppliedError) {
        await this.recordJobResult(userId, error.job.campaignId, error.job.key, {
          outcome: "skipped",
          skipReason: duplicateSkipReason(error.duplicate),
        });
      }
      throw error;
    }
  }

  publishClaimedJob(userId: string, campaignId: string, job: Job): void {
    this.publishJob(userId, campaignId, job, "updated");
  }

  async promoteScoredJobs(
    userId: string,
    campaignId: string,
    source: CampaignSource,
    candidates: ScoredJobPromotion[],
  ): Promise<void> {
    if (candidates.length === 0) return;

    const { jobs, summary } = await writeScoredPromotions(
      this.prisma,
      userId,
      campaignId,
      source,
      candidates,
    );
    if (jobs.length === 0) return;

    for (const job of jobs) {
      this.publishJob(userId, campaignId, job, "updated");
    }
    publish(campaignChannel, { campaignId }, { type: "progress", payload: summary });
  }

  async recordJobResult(
    userId: string,
    campaignId: string,
    key: string,
    data: CampaignJobResultInput,
  ) {
    const result = await writeJobResult(this.prisma, userId, campaignId, key, data);
    this.publishStatusChange(userId, campaignId, { ...result, job: result.campaignJob });
    if (result.changed && result.application) {
      publish(workspaceChannel, { userId }, { type: "application.created", campaignId });
    }

    return {
      campaignJob: result.campaignJob,
      application: result.application,
      summary: result.summary,
    };
  }

  /** Publishes a status write: the row plus the campaign totals. Every path that moves a job
   * between statuses goes through here, so tiles stay live for viewers who did not initiate it. */
  private publishStatusChange(
    userId: string,
    campaignId: string,
    result: { job: Job; changed: boolean; summary: CampaignSummary | null },
  ) {
    if (!result.changed) return;
    this.publishJob(userId, campaignId, result.job, "updated");
    if (result.summary) {
      publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
    }
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
