import type {
  AddCampaignJobInput,
  CampaignJobReason,
  CampaignJobResultInput,
  CampaignJobStatus,
  CampaignSummary,
  PatchCampaignJobInput,
  RescanCampaignJobInput,
  RetryCampaignJobInput,
} from "@jobpilot/contracts/campaign";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type CampaignSource,
  type Job,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { JobListingPublisher } from "@/modules/job-listing";
import { PROMOTABLE_SOURCES } from "../campaign.mapper";
import { deriveCampaignSummary } from "../campaign.summary";
import { ensureCampaignOwned } from "../campaign.utils";
import { assertNotAlreadyApplied } from "./applied-guard";
import { writeJobRescan, writeJobRetry } from "./job-commands";
import { isTerminalJob, writeJobResult } from "./job-result";

const ALLOWED_TRANSITIONS: Record<CampaignJobStatus, readonly CampaignJobStatus[]> = {
  // A score pass promotes a pasted link into the normal pipeline; nothing ever moves back to queued.
  queued: ["pending"],
  pending: ["approved"],
  approved: ["pending", "applying"],
  applying: ["approved", "needs_user"],
  needs_user: ["approved", "applying"],
  applied: [],
  failed: [],
  skipped: [],
};

type JobTransaction = Pick<Prisma.TransactionClient, "job" | "application">;

interface ScoredJobPromotion {
  key: string;
  matchScore: number;
  threshold: number;
}

/** Coordinates campaign job discovery, non-terminal edits, claims, and terminal results. */
@singleton()
export class CampaignJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly listings: JobListingPublisher,
  ) {}

  async listJobs(
    userId: string,
    campaignId: string,
    query: PaginationQuery & { status?: CampaignJobStatus; search?: string },
  ) {
    const where: Prisma.JobWhereInput = {
      campaignId,
      campaign: { userId },
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { company: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    // The page is already ownership-scoped; the probe only separates 404 from an empty page, so
    // it rides along rather than costing a round trip of its own.
    const [, jobs, total] = await Promise.all([
      ensureCampaignOwned(this.prisma, userId, campaignId),
      this.prisma.job.findMany({ where, orderBy: { createdAt: "asc" }, ...pageSlice(query) }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(jobs, query, total);
  }

  /** Skip/fail reasons grouped by frequency across every job, so the breakdown is not page-scoped. */
  async listJobReasons(userId: string, campaignId: string): Promise<CampaignJobReason[]> {
    await ensureCampaignOwned(this.prisma, userId, campaignId);

    const [skipped, failed] = await Promise.all([
      this.prisma.job.groupBy({
        by: ["skipReason"],
        where: { campaignId, status: "skipped", skipReason: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ["failReason"],
        where: { campaignId, status: "failed", failReason: { not: null } },
        _count: { _all: true },
      }),
    ]);

    // The `{ not: null }` guards above make the reason non-null on every row.
    const reasons: CampaignJobReason[] = [
      ...skipped.map((row) => ({
        kind: "skipped" as const,
        reason: row.skipReason as string,
        count: row._count._all,
      })),
      ...failed.map((row) => ({
        kind: "failed" as const,
        reason: row.failReason as string,
        count: row._count._all,
      })),
    ];
    return reasons.sort((a, b) => b.count - a.count);
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
    const existing = await findOwned(
      (where) =>
        this.prisma.job.findFirst({ where, include: { campaign: { select: { source: true } } } }),
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
        if (patch.status === "applying") {
          await assertNotAlreadyApplied(tx, userId, existing);
        }
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
          title: patch.title,
          company: patch.company,
          location: patch.location,
          salary: patch.salary,
          type: patch.type,
          board: patch.board,
          retryNotes: patch.retryNotes,
          matchScore: patch.matchScore,
          matchReason: patch.matchReason,
          description: patch.description,
          digest: patch.digest,
        },
      });
    });

    this.listings.publishInBackground(job);
    const statusChanged = !!patch.status && patch.status !== existing.status;
    this.publishStatusChange(userId, campaignId, {
      job,
      changed: true,
      summary: statusChanged
        ? await deriveCampaignSummary(this.prisma, campaignId, existing.campaign.source)
        : null,
    });
    return job;
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

  async claimJobForApplyInTransaction(
    tx: JobTransaction,
    userId: string,
    campaignId: string,
    key: string,
  ): Promise<Job> {
    const target = await tx.job.findFirst({
      where: { campaignId, key, status: "approved", campaign: { userId } },
      select: { url: true, title: true, company: true },
    });
    if (!target) throw conflict("Job is no longer approved.");
    await assertNotAlreadyApplied(tx, userId, target);

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
    source: CampaignSource,
    candidates: ScoredJobPromotion[],
  ): Promise<void> {
    if (candidates.length === 0) return;
    // One write per (outcome, score) group rather than three per row. Grouping by score keeps the
    // `matchScore` guard - which detects a concurrent rescore - exact under an `in` on keys, and
    // lets skipped rows sharing a score share their score-bearing reason prose.
    const groups = new Map<
      string,
      { approved: boolean; score: number; threshold: number; keys: string[] }
    >();

    for (const candidate of candidates) {
      const approved = candidate.matchScore >= candidate.threshold;
      const groupKey = `${approved}:${candidate.matchScore}`;
      const group = groups.get(groupKey) ?? {
        approved,
        score: candidate.matchScore,
        threshold: candidate.threshold,
        keys: [],
      };
      group.keys.push(candidate.key);
      groups.set(groupKey, group);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const jobs: Job[] = [];

      for (const group of groups.values()) {
        const updated = await tx.job.updateManyAndReturn({
          where: {
            campaignId,
            status: "pending",
            matchScore: group.score,
            key: { in: group.keys },
            campaign: { userId, status: "in_progress", source: { in: PROMOTABLE_SOURCES } },
          },
          data: group.approved
            ? { status: "approved" }
            : {
                status: "skipped",
                skipReason: `Below minimum match score (${group.score} < ${group.threshold})`,
              },
        });
        jobs.push(...updated);
      }

      return { jobs, summary: await deriveCampaignSummary(tx, campaignId, source) };
    });

    if (result.jobs.length === 0) return;
    for (const job of result.jobs) {
      this.publishJob(userId, campaignId, job, "updated");
    }
    publish(campaignChannel, { campaignId }, { type: "progress", payload: result.summary });
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
