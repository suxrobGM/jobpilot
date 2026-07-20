import { singleton } from "tsyringe";
import { PushService } from "@/common/push";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "@/modules/campaign/campaign.service";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { PilotJournalService } from "../journal.service";
import { loadInstructions } from "../pilot.instructions";
import { countAppliedToday, countSentToday } from "../pilot.stats";
import { buildAgenda } from "./build";
import { writeDigestIfDue } from "./digest";
import { runExpiry } from "./expiry";
import { gatherAnsweredQuestions, gatherFinalizeCampaigns, gatherInbox } from "./gather";
import { gatherInterviewPreps, gatherInterviewReplies } from "./gather-interview";
import {
  attachWarmContacts,
  dueSavedSearches,
  gatherApprovedJobs,
  gatherScorePendingCampaigns,
} from "./gather-jobs";
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
import { promoteScoredPendingJobs } from "./promote";

@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly pilot: PilotJournalService,
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

    const { prisma } = this;
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
      prisma.question.count({ where: { userId, status: "open" } }),
      gatherAnsweredQuestions(prisma, userId),
      prisma.pilotLease.count({ where: { userId, releasedAt: null, expiresAt: { gt: now } } }),
      gatherApprovedJobs(prisma, userId, config.parkedBoards),
      countAppliedToday(prisma, userId, now),
      gatherFinalizeCampaigns(prisma, userId),
      gatherInbox(prisma, userId),
      // Networking off: skip its gathers (the builder gates too, but these are pure waste when disabled).
      config.networkingEnabled ? gatherApprovedNetworking(prisma, userId) : [],
      config.networkingEnabled ? countSentToday(prisma, userId, now) : 0,
      config.networkingEnabled ? gatherFollowups(prisma, userId, config, now) : [],
      gatherApprovedPromotions(prisma, userId, now),
      duePlatforms(prisma, userId, config, now),
      gatherInterviewReplies(prisma, userId),
      gatherInterviewPreps(prisma, userId),
      gatherQueueDrain(prisma, userId),
      gatherBoardHealth(prisma, userId, config.parkedBoards),
    ]);

    // Warm-check join: attach same-company contacts to high-score jobs so the builder can offer a warm intro.
    if (config.networkingEnabled) await attachWarmContacts(prisma, userId, approvedJobs);

    // Discovery and scoring existing pending rows only matter when the apply pipeline is empty; skip
    // both lookups otherwise. Scoring the found-but-unscored backlog ranks above fresh discovery.
    const [dueQueries, scorePending] =
      approvedJobs.length === 0
        ? await Promise.all([
            dueSavedSearches(prisma, userId, config, now),
            gatherScorePendingCampaigns(prisma, userId, config.minScore, now, config.parkedBoards),
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
          gatherQuietCandidates(prisma, userId, now),
          gatherBootstrap(prisma, userId, config, goals, now),
        ])
      : [{ strategyReviews: [], rescanSkipped: [], retryFailed: [] }, null];

    // Idempotent per UTC day; fire-and-forget so a slow push never delays the agenda response.
    void writeDigestIfDue(
      { prisma, pilot: this.pilot, push: this.push },
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
}
