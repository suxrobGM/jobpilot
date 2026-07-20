import type { ReleasePilotLeaseInput } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { type PilotLease, PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "@/modules/campaign/campaign.service";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { loadInstructions } from "../pilot.instructions";
import { toPilotLease } from "../pilot.mapper";
import { PilotService } from "../pilot.service";
import { countAppliedToday, countSentToday } from "../pilot.stats";
import { buildAgenda } from "./build";
import { writeDigestIfDue } from "./digest";
import { jobRef, parsePayload, revertJobToApproved, runExpiry } from "./expiry";
import {
  attachWarmContacts,
  dueSavedSearches,
  gatherAnsweredQuestions,
  gatherApprovedJobs,
  gatherFinalizeCampaigns,
  gatherInbox,
  gatherScorePendingCampaigns,
} from "./gather";
import { gatherInterviewPreps, gatherInterviewReplies } from "./gather-interview";
import {
  duePlatforms,
  gatherApprovedNetworking,
  gatherApprovedPromotions,
  gatherFollowups,
} from "./gather-networking";
import {
  gatherBoardHealth,
  gatherBootstrap,
  gatherQueueDrain,
  gatherQuietCandidates,
} from "./gather-proactive";
import { verifyGrant } from "./grant";
import { promoteScoredPendingJobs } from "./promote";

const LEASE_TTL_MS = 15 * 60 * 1000;

@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly pilot: PilotService,
    private readonly push: PushService,
    private readonly campaigns: CampaignService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  async compile(userId: string) {
    const now = new Date();
    // Pre-gather mutations so the compiled agenda reflects them. Config, expiry, and self-heal are
    // mutually independent; promotion trails all three - it needs config.minScore and only sees a
    // campaign the heal already flipped back to in_progress. It flips scored-pending rows to
    // approved so they surface as apply work this same cycle.
    const [{ config, goals }] = await Promise.all([
      loadInstructions(this.prisma, userId),
      runExpiry(this.jobDeps, userId, now),
      this.campaigns.selfHealForPilot(userId),
    ]);
    await promoteScoredPendingJobs(this.jobDeps, userId, config.minScore);

    const [
      openQuestions,
      answeredQuestions,
      activeLeases,
      approvedJobs,
      appliedToday,
      finalizeCampaigns,
      inbox,
      approvedNetworking,
      networkingSentToday,
      followups,
      approvedPromotions,
      duePlatformList,
      interviewReplies,
      interviewPreps,
      queue,
      boardHealth,
    ] = await Promise.all([
      this.prisma.question.count({ where: { userId, status: "open" } }),
      gatherAnsweredQuestions(this.prisma, userId),
      this.prisma.pilotLease.count({
        where: { userId, releasedAt: null, expiresAt: { gt: now } },
      }),
      gatherApprovedJobs(this.prisma, userId, config.parkedBoards),
      countAppliedToday(this.prisma, userId, now),
      gatherFinalizeCampaigns(this.prisma, userId),
      gatherInbox(this.prisma, userId),
      // Networking off: skip its gathers (the builder gates too, but these are pure waste when disabled).
      config.networkingEnabled ? gatherApprovedNetworking(this.prisma, userId) : [],
      config.networkingEnabled ? countSentToday(this.prisma, userId, now) : 0,
      config.networkingEnabled ? gatherFollowups(this.prisma, userId, config, now) : [],
      gatherApprovedPromotions(this.prisma, userId, now),
      duePlatforms(this.prisma, userId, config, now),
      gatherInterviewReplies(this.prisma, userId),
      gatherInterviewPreps(this.prisma, userId),
      gatherQueueDrain(this.prisma, userId),
      gatherBoardHealth(this.prisma, userId, config.parkedBoards),
    ]);

    // Warm-check join: attach same-company contacts to high-score jobs so the builder can offer a warm intro.
    if (config.networkingEnabled) await attachWarmContacts(this.prisma, userId, approvedJobs);

    // Discovery and scoring existing pending rows only matter when the apply pipeline is empty; skip
    // both lookups otherwise. Scoring the found-but-unscored backlog ranks above fresh discovery.
    const [dueQueries, scorePending] =
      approvedJobs.length === 0
        ? await Promise.all([
            dueSavedSearches(this.prisma, userId, config, now),
            gatherScorePendingCampaigns(this.prisma, userId, config.minScore, config.parkedBoards),
          ])
        : [[], []];

    // Quiet-agenda maintenance runs only when nothing apply/discover/score/queue-shaped is pending
    // anyway, so gather its candidates only then - the builder still gates authoritatively.
    const pipelineQuiet =
      approvedJobs.length === 0 &&
      dueQueries.length === 0 &&
      scorePending.length === 0 &&
      queue.pendingCount === 0;
    const [quiet, bootstrap] = pipelineQuiet
      ? await Promise.all([
          gatherQuietCandidates(this.prisma, userId, now),
          gatherBootstrap(this.prisma, userId, config, goals, now),
        ])
      : [{ strategyReviews: [], rescanSkipped: [], retryFailed: [] }, null];

    // Idempotent per UTC day; fire-and-forget so a slow push never delays the agenda response.
    void writeDigestIfDue(
      { prisma: this.prisma, pilot: this.pilot, push: this.push },
      userId,
      now,
      openQuestions,
    );

    return buildAgenda({
      now,
      config,
      openQuestions,
      answeredQuestions,
      activeLeases,
      approvedJobs,
      appliedToday,
      dueQueries,
      scorePending,
      finalizeCampaigns,
      inbox,
      approvedNetworking,
      networkingSentToday,
      followups,
      duePlatforms: duePlatformList,
      approvedPromotions,
      interviewReplies,
      interviewPreps,
      queue,
      boardHealth,
      strategyReviews: quiet.strategyReviews,
      rescanSkipped: quiet.rescanSkipped,
      retryFailed: quiet.retryFailed,
      bootstrap,
    });
  }

  // ── Leasing ──────────────────────────────────────────────────────────────────

  async lease(userId: string, itemId: string) {
    const agenda = await this.compile(userId);
    const item = agenda.items.find((i) => i.id === itemId);
    if (!item) {
      throw conflict("Agenda item is no longer available.");
    }

    // One active lease per subject: refuses a second worker taking the same item (409).
    const active = await this.prisma.pilotLease.findFirst({
      where: {
        userId,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        releasedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (active) {
      throw conflict("This item is already leased.");
    }

    // Server-side grant gates: re-verify the row is still in a leasable state, ignoring agent claims.
    await verifyGrant(this.prisma, userId, item.kind, item.subjectId);

    const { campaignId, jobKey } = item.payload as { campaignId?: string; jobKey?: string };
    // Single-writer claim first: only one lease can flip approved->applying (409 on a lost race).
    const jobClaim =
      item.kind === "job.apply" && campaignId && jobKey ? { campaignId, jobKey } : null;
    if (jobClaim) {
      await this.campaignJobs.claimJobForApply(userId, jobClaim.campaignId, jobClaim.jobKey);
    }

    let lease: PilotLease;
    try {
      lease = await this.prisma.pilotLease.create({
        data: {
          userId,
          kind: item.kind,
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          payload: JSON.stringify(item.payload),
          expiresAt: new Date(Date.now() + LEASE_TTL_MS),
        },
      });
    } catch (err) {
      // A claim without a lease row would strand the job in applying; hand it back to the agenda.
      if (jobClaim) {
        await revertJobToApproved(this.jobDeps, userId, jobClaim.campaignId, jobClaim.jobKey);
      }
      throw err;
    }

    return { ...toPilotLease(lease), payload: item.payload };
  }

  async heartbeat(userId: string, id: string) {
    const existing = await findOwned(
      (where) =>
        this.prisma.pilotLease.findFirst({ where, select: { id: true, releasedAt: true } }),
      { id, userId },
      "Lease",
    );
    // A released lease must not get its TTL resurrected by a late worker heartbeat.
    if (existing.releasedAt) throw conflict("Lease is already released.");
    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { heartbeatAt: new Date(), expiresAt: new Date(Date.now() + LEASE_TTL_MS) },
    });
    return toPilotLease(lease);
  }

  async release(userId: string, id: string, body: ReleasePilotLeaseInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where }),
      { id, userId },
      "Lease",
    );
    // A released lease is terminal; a second release must not overwrite its recorded outcome.
    if (existing.releasedAt) throw conflict("Lease is already released.");

    const parsed = parsePayload(existing.payload);
    const { campaignId, jobKey } = jobRef(parsed, existing.subjectId);
    // "abandoned" un-claims the work; the terminal result for done/failed arrives via the campaign result route.
    if (body.outcome === "abandoned" && existing.kind === "job.apply" && campaignId) {
      await revertJobToApproved(this.jobDeps, userId, campaignId, jobKey);
    }

    const payload = body.note
      ? JSON.stringify({ ...parsed, releaseNote: body.note })
      : existing.payload;

    const lease = await this.prisma.pilotLease.update({
      where: { id },
      data: { releasedAt: new Date(), outcome: body.outcome, payload },
    });
    return toPilotLease(lease);
  }
}
