import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
  type ReleasePilotLeaseInput,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { type PilotLease, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
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
} from "./gather";
import { gatherInterviewPreps, gatherInterviewReplies } from "./gather-interview";
import {
  duePlatforms,
  gatherApprovedOutreach,
  gatherApprovedPromotions,
  gatherFollowups,
} from "./gather-outreach";
import { gatherBoardHealth, gatherQueueDrain, gatherQuietCandidates } from "./gather-proactive";
import { verifyGrant } from "./grant";

const LEASE_TTL_MS = 15 * 60 * 1000;

@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly pilot: PilotService,
    private readonly push: PushService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  private async loadConfig(profileId: string): Promise<PilotInstructionsConfig> {
    const state = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
    return pilotInstructionsConfigSchema.parse(JSON.parse(state.instructionsConfig));
  }

  async compile(profileId: string) {
    const now = new Date();
    // Config and the expiry sweep are independent; both must settle before the main batch.
    const [config] = await Promise.all([
      this.loadConfig(profileId),
      runExpiry(this.jobDeps, profileId, now),
    ]);

    const tz = config.activeHours?.tz;
    const [
      openQuestions,
      answeredQuestions,
      activeLeases,
      approvedJobs,
      appliedToday,
      finalizeCampaigns,
      inbox,
      approvedOutreach,
      outreachSentToday,
      followups,
      approvedPromotions,
      duePlatformList,
      interviewReplies,
      interviewPreps,
      queue,
      boardHealth,
    ] = await Promise.all([
      this.prisma.question.count({ where: { profileId, status: "open" } }),
      gatherAnsweredQuestions(this.prisma, profileId),
      this.prisma.pilotLease.count({
        where: { profileId, releasedAt: null, expiresAt: { gt: now } },
      }),
      gatherApprovedJobs(this.prisma, profileId, config.parkedBoards),
      countAppliedToday(this.prisma, profileId, now, tz),
      gatherFinalizeCampaigns(this.prisma, profileId),
      gatherInbox(this.prisma, profileId),
      gatherApprovedOutreach(this.prisma, profileId),
      countSentToday(this.prisma, profileId, now, tz),
      gatherFollowups(this.prisma, profileId, config, now),
      gatherApprovedPromotions(this.prisma, profileId, now),
      duePlatforms(this.prisma, profileId, config, now),
      gatherInterviewReplies(this.prisma, profileId),
      gatherInterviewPreps(this.prisma, profileId),
      gatherQueueDrain(this.prisma, profileId),
      gatherBoardHealth(this.prisma, profileId, config.parkedBoards),
    ]);

    // Warm-check join: attach same-company contacts to high-score jobs so the builder can offer a warm intro.
    await attachWarmContacts(this.prisma, profileId, approvedJobs);

    // Discovery only matters when the apply pipeline is empty; skip the lease lookups otherwise.
    const dueQueries =
      approvedJobs.length === 0 ? await dueSavedSearches(this.prisma, profileId, config, now) : [];

    // Quiet-agenda maintenance runs only when nothing apply/discover/queue-shaped is pending anyway,
    // so gather its candidates only then - the builder still gates authoritatively.
    const pipelineQuiet =
      approvedJobs.length === 0 && dueQueries.length === 0 && queue.pendingCount === 0;
    const quiet = pipelineQuiet
      ? await gatherQuietCandidates(this.prisma, profileId, now)
      : { strategyReviews: [], rescanSkipped: [], retryFailed: [] };

    // Idempotent per tz-day; fire-and-forget so a slow push never delays the agenda response.
    void writeDigestIfDue(
      { prisma: this.prisma, pilot: this.pilot, push: this.push },
      profileId,
      now,
      config,
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
      finalizeCampaigns,
      inbox,
      approvedOutreach,
      outreachSentToday,
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
    });
  }

  // ── Leasing ──────────────────────────────────────────────────────────────────

  async lease(profileId: string, itemId: string) {
    const agenda = await this.compile(profileId);
    const item = agenda.items.find((i) => i.id === itemId);
    if (!item) {
      throw conflict("Agenda item is no longer available.");
    }

    // One active lease per subject: refuses a second worker taking the same item (409).
    const active = await this.prisma.pilotLease.findFirst({
      where: {
        profileId,
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
    await verifyGrant(this.prisma, profileId, item.kind, item.subjectId);

    const { campaignId, jobKey } = item.payload as { campaignId?: string; jobKey?: string };
    // Single-writer claim first: only one lease can flip approved->applying (409 on a lost race).
    const jobClaim =
      item.kind === "job.apply" && campaignId && jobKey ? { campaignId, jobKey } : null;
    if (jobClaim) {
      await this.campaignJobs.claimJobForApply(profileId, jobClaim.campaignId, jobClaim.jobKey);
    }

    let lease: PilotLease;
    try {
      lease = await this.prisma.pilotLease.create({
        data: {
          profileId,
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
        await revertJobToApproved(this.jobDeps, profileId, jobClaim.campaignId, jobClaim.jobKey);
      }
      throw err;
    }

    return { ...toPilotLease(lease), payload: item.payload };
  }

  async heartbeat(profileId: string, id: string) {
    const existing = await findOwned(
      (where) =>
        this.prisma.pilotLease.findFirst({ where, select: { id: true, releasedAt: true } }),
      { id, profileId },
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

  async release(profileId: string, id: string, body: ReleasePilotLeaseInput) {
    const existing = await findOwned(
      (where) => this.prisma.pilotLease.findFirst({ where }),
      { id, profileId },
      "Lease",
    );
    // A released lease is terminal; a second release must not overwrite its recorded outcome.
    if (existing.releasedAt) throw conflict("Lease is already released.");

    const parsed = parsePayload(existing.payload);
    const { campaignId, jobKey } = jobRef(parsed, existing.subjectId);
    // "abandoned" un-claims the work; the terminal result for done/failed arrives via the campaign result route.
    if (body.outcome === "abandoned" && existing.kind === "job.apply" && campaignId) {
      await revertJobToApproved(this.jobDeps, profileId, campaignId, jobKey);
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
