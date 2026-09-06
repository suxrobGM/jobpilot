import {
  type AgendaResponse,
  agendaResponseSchema,
  channelAutonomy,
  networkingMode,
} from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { conflict } from "@/common/errors";
import { reviveJsonDates, toInputJson } from "@/common/json";
import { PushService } from "@/common/push/push.service";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { EmailSyncService } from "@/modules/email/sync/sync.service";
import { PilotJournalService } from "../journal.service";
import { loadInstructions } from "../pilot.instructions";
import { countAppliedToday, countSentToday } from "../stats";
import { buildAgenda } from "./build";
import { gatherBoardHealth } from "./candidates-board";
import { gatherBootstrap } from "./candidates-bootstrap";
import { gatherInbox } from "./candidates-inbox";
import { gatherQuietCandidates } from "./candidates-maintenance";
import { gatherPausedCampaigns } from "./candidates-paused";
import { gatherAnsweredQuestions } from "./candidates-questions";
import { gatherQueueDrain } from "./candidates-queue";
import { INBOX_SYNC_STALE_MS } from "./constants";
import { writeDigestIfDue } from "./digest";
import { runExpiry } from "./expiry";
import { finalizeIdleCampaigns } from "./finalize";
import { gatherInterviewPreps, gatherInterviewReplies } from "./gather-interview";
import {
  attachWarmContacts,
  duePilotSearches,
  gatherApprovedJobs,
  gatherScorePendingCampaigns,
  gatherWarmIntroCandidates,
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
    private readonly emailSync: EmailSyncService,
  ) {}

  private get jobDeps() {
    return { prisma: this.prisma, campaignJobs: this.campaignJobs };
  }

  async getCurrent(userId: string) {
    const state = await this.prisma.pilotState.findUnique({ where: { userId } });
    if (!state?.running) throw conflict("Pilot is stopped.");
    if (!state.agendaSnapshot || !state.agendaExpiresAt || state.agendaExpiresAt <= new Date()) {
      return { agenda: null };
    }
    return { agenda: parseAgendaSnapshot(state.agendaSnapshot) };
  }

  async refresh(userId: string): Promise<AgendaResponse> {
    const state = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { running: true, cycleCount: true },
    });
    if (!state?.running) throw conflict("Pilot is stopped.");

    const now = new Date();
    const { config, goals } = await loadInstructions(this.prisma, userId);
    // Sends and followups only act on email drafts, so an off email channel makes gathering moot.
    const emailNetworking = channelAutonomy(config, "email") !== null;
    const outreach = networkingMode(config) !== null;

    // Before the inbox gather, so `inbox.review` sees mail that arrived since the last cycle.
    await this.emailSync.syncIfStale(userId, INBOX_SYNC_STALE_MS, now);

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
      queueDrains,
      boardHealth,
      searchCount,
    ] = await Promise.all([
      prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
      gatherAnsweredQuestions(prisma, userId),
      prisma.pilotClaim.count({ where: { userId, releasedAt: null, expiresAt: { gt: now } } }),
      gatherApprovedJobs(prisma, userId),
      countAppliedToday(prisma, userId, now),
      gatherPausedCampaigns(prisma, userId, now),
      gatherInbox(prisma, userId),
      emailNetworking ? gatherApprovedNetworking(prisma, userId) : [],
      outreach ? countSentToday(prisma, userId, now) : 0,
      emailNetworking ? gatherFollowups(prisma, userId, config, now) : [],
      gatherApprovedPromotions(prisma, userId, now),
      duePlatforms(prisma, userId, config, now),
      gatherInterviewReplies(prisma, userId),
      gatherInterviewPreps(prisma, userId),
      gatherQueueDrain(prisma, userId, config.minScore, now),
      gatherBoardHealth(prisma, userId),
      prisma.pilotSearch.count({ where: { userId } }),
    ]);
    const awaitingSetup = searchCount === 0 || goals.trim() === "";

    // A spent send budget makes the pool moot.
    const warmIntroCandidates =
      outreach && networkingSentToday < config.networking.dailyCap
        ? await gatherWarmIntroCandidates(prisma, userId, now, approvedJobs)
        : [];
    // Both sets, because the pool drops claim-damped jobs whose apply items still want the contact.
    // Approved jobs appear in both as shared references, so the second pass is a no-op for them.
    await attachWarmContacts(prisma, userId, [...approvedJobs, ...warmIntroCandidates]);

    const [{ due: dueQueries, nextSearchRunAt }, scorePending] =
      approvedJobs.length === 0
        ? await Promise.all([
            duePilotSearches(prisma, userId, config, now, appliedToday),
            gatherScorePendingCampaigns(prisma, userId, config.minScore, now),
          ])
        : [{ due: [], nextSearchRunAt: null }, []];

    const pipelineQuiet =
      approvedJobs.length === 0 &&
      dueQueries.length === 0 &&
      scorePending.length === 0 &&
      queueDrains.length === 0;

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
      cycleCount: state.cycleCount,
      openQuestions,
      answeredQuestions,
      activeClaims,
      approvedJobs,
      warmIntroCandidates,
      appliedToday,
      dueQueries,
      awaitingSetup,
      nextSearchRunAt,
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
      queueDrains,
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
