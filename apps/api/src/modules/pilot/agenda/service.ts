import { type AgendaResponse, agendaResponseSchema } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict } from "@/common/errors";
import { reviveJsonDates, toInputJson } from "@/common/json";
import { PushService } from "@/common/push";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { PilotJournalService } from "../journal.service";
import { loadInstructions } from "../pilot.instructions";
import { countAppliedToday, countSentToday } from "../pilot.stats";
import { buildAgenda } from "./build";
import { gatherBoardHealth } from "./candidates-board";
import { gatherBootstrap } from "./candidates-bootstrap";
import { gatherInbox } from "./candidates-inbox";
import { gatherQuietCandidates } from "./candidates-maintenance";
import { gatherPausedCampaigns } from "./candidates-paused";
import { gatherAnsweredQuestions } from "./candidates-questions";
import { gatherQueueDrain } from "./candidates-queue";
import { writeDigestIfDue } from "./digest";
import { runExpiry } from "./expiry";
import { finalizeIdleCampaigns } from "./finalize";
import { gatherInterviewPreps, gatherInterviewReplies } from "./gather-interview";
import {
  attachWarmContacts,
  duePilotSearches,
  gatherApprovedJobs,
  gatherScorePendingCampaigns,
} from "./gather-jobs";
import {
  duePlatforms,
  gatherApprovedNetworking,
  gatherApprovedPromotions,
  gatherFollowups,
} from "./gather-networking";
import { promoteScoredPendingJobs } from "./promote";

export const AGENDA_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

/** Validates a stored agenda snapshot and restores its date fields. */
export function parseAgendaSnapshot(value: unknown): AgendaResponse {
  return agendaResponseSchema.parse(reviveJsonDates(value));
}

/** Reads immutable snapshots and explicitly refreshes the mutating agenda pipeline. */
@singleton()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly campaignJobs: CampaignJobService,
    private readonly pilot: PilotJournalService,
    private readonly push: PushService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  async getCurrent(userId: string) {
    const state = await this.prisma.pilotState.findUnique({ where: { userId } });
    if (!state?.enabled) throw conflict("Pilot is disabled.");
    if (!state.agendaSnapshot || !state.agendaExpiresAt || state.agendaExpiresAt <= new Date()) {
      return { agenda: null };
    }
    return { agenda: parseAgendaSnapshot(state.agendaSnapshot) };
  }

  async refresh(userId: string): Promise<AgendaResponse> {
    const state = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { enabled: true },
    });
    if (!state?.enabled) throw conflict("Pilot is disabled.");

    const now = new Date();
    const { config, goals } = await loadInstructions(this.prisma, userId);

    await runExpiry(this.prisma, userId, now);
    await promoteScoredPendingJobs(this.jobDeps, userId, config.minScore);
    // After promotion, so freshly-approved rows keep their campaign out of the idle sweep.
    await finalizeIdleCampaigns({ prisma: this.prisma, pilot: this.pilot }, userId, now);

    const { prisma } = this;
    const [
      openQuestions,
      answeredQuestions,
      activeClaims,
      approvedJobs,
      appliedToday,
      pausedCampaigns,
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
      searchCount,
    ] = await Promise.all([
      prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
      gatherAnsweredQuestions(prisma, userId),
      prisma.pilotClaim.count({ where: { userId, releasedAt: null, expiresAt: { gt: now } } }),
      gatherApprovedJobs(prisma, userId, config.parkedBoards),
      countAppliedToday(prisma, userId, now),
      gatherPausedCampaigns(prisma, userId, now, config.parkedBoards),
      gatherInbox(prisma, userId),
      config.networkingEnabled ? gatherApprovedNetworking(prisma, userId) : [],
      config.networkingEnabled ? countSentToday(prisma, userId, now) : 0,
      config.networkingEnabled ? gatherFollowups(prisma, userId, config, now) : [],
      gatherApprovedPromotions(prisma, userId, now),
      duePlatforms(prisma, userId, config, now),
      gatherInterviewReplies(prisma, userId),
      gatherInterviewPreps(prisma, userId),
      gatherQueueDrain(prisma, userId),
      gatherBoardHealth(prisma, userId, config.parkedBoards),
      prisma.pilotSearch.count({ where: { userId } }),
    ]);
    const goalsPresent = goals.trim().length > 0;

    if (config.networkingEnabled) {
      await attachWarmContacts(prisma, userId, approvedJobs);
    }

    const [dueSearches, scorePending] =
      approvedJobs.length === 0
        ? await Promise.all([
            duePilotSearches(prisma, userId, config, now, appliedToday),
            gatherScorePendingCampaigns(prisma, userId, config.minScore, now, config.parkedBoards),
          ])
        : [{ due: [], nextSearchRunAt: null }, []];

    const dueQueries = dueSearches.due;

    const pipelineQuiet =
      approvedJobs.length === 0 &&
      dueQueries.length === 0 &&
      scorePending.length === 0 &&
      queue.pendingCount === 0;

    const [quiet, bootstrap] = pipelineQuiet
      ? await Promise.all([
          gatherQuietCandidates(prisma, userId, now),
          gatherBootstrap(prisma, userId, config, goals, now, searchCount),
        ])
      : [{ strategyReviews: [], rescanSkipped: [], retryFailed: [] }, null];

    void writeDigestIfDue(
      { prisma, pilot: this.pilot, push: this.push },
      userId,
      now,
      openQuestions,
    );

    const content = buildAgenda({
      now,
      config,
      openQuestions,
      answeredQuestions,
      activeClaims,
      approvedJobs,
      appliedToday,
      dueQueries,
      searchCount,
      goalsPresent,
      nextSearchRunAt: dueSearches.nextSearchRunAt,
      scorePending,
      pausedCampaigns,
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

    const agenda: AgendaResponse = {
      ...content,
      version: crypto.randomUUID(),
      expiresAt: new Date(now.getTime() + AGENDA_SNAPSHOT_TTL_MS),
    };

    await prisma.pilotState.update({
      where: { userId },
      data: {
        agendaVersion: agenda.version,
        agendaGeneratedAt: agenda.generatedAt,
        agendaExpiresAt: agenda.expiresAt,
        agendaSnapshot: toInputJson(agenda),
      },
    });
    return agenda;
  }
}
