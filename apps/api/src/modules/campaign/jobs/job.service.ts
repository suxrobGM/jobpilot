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
import { JobListingPublisher } from "@/modules/job-listing";
import { ensureCampaignOwned } from "../campaign.utils";
import {
  type AlreadyAppliedError,
  type GuardTransaction,
  skipIfAlreadyApplied,
} from "./applied-guard";
import { writeJobPatch, writeJobRescan, writeJobRetry } from "./job-commands";
import { type ScoredJobPromotion, writeScoredPromotions } from "./job-promotion";
import { type JobListQuery, listCampaignJobReasons, listCampaignJobs } from "./job-queries";
import { writeJobResult } from "./job-result";

/** A claim that was refused because this profile had already applied; the guard wrote the skip. */
export type ClaimAttempt = { job: Job } | { refusal: AlreadyAppliedError };

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
    const result = await writeJobPatch(this.prisma, userId, campaignId, key, patch);
    if ("refusal" in result) {
      this.publishDuplicateSkip(userId, campaignId, result.refusal);
      throw result.refusal;
    }

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

  /**
   * Moves an approved job into `applying`. The pilot claims inside its own transaction, so this
   * takes a client rather than opening one, and a duplicate comes back as a refusal rather than a
   * throw - the guard's skip has to commit with that transaction, not roll back with it.
   */
  async claimJobForApplyInTransaction(
    tx: GuardTransaction,
    userId: string,
    campaignId: string,
    key: string,
  ): Promise<ClaimAttempt> {
    const where = {
      campaignId,
      key,
      status: "approved",
      campaign: { userId },
    } satisfies Prisma.JobWhereInput;

    const target = await tx.job.findFirst({
      where,
      select: { url: true, title: true, company: true, campaign: { select: { source: true } } },
    });
    if (!target) throw conflict("Job is no longer approved.");

    const refusal = await skipIfAlreadyApplied(tx, userId, { ...target, campaignId, key });
    if (refusal) return { refusal };

    // Returning the row from the write keeps the claim at two round trips; an empty result is the
    // lost race.
    const [claimed] = await tx.job.updateManyAndReturn({ where, data: { status: "applying" } });
    if (!claimed) throw conflict("Job is no longer approved.");
    return { job: claimed };
  }

  async claimJobForApply(userId: string, campaignId: string, key: string) {
    const attempt = await this.prisma.$transaction((tx) =>
      this.claimJobForApplyInTransaction(tx, userId, campaignId, key),
    );
    if ("refusal" in attempt) {
      this.publishDuplicateSkip(userId, campaignId, attempt.refusal);
      throw attempt.refusal;
    }

    this.publishJob(userId, campaignId, attempt.job, "updated");
    return attempt.job;
  }

  /** Publishes the skip the duplicate guard already committed inside the caller's transaction. */
  publishDuplicateSkip(userId: string, campaignId: string, refusal: AlreadyAppliedError): void {
    if (!refusal.skipped) return;
    this.publishStatusChange(userId, campaignId, { ...refusal.skipped, changed: true });
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
