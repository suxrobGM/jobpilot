import {
  type AnswerPilotQuestionInput,
  type CreatePilotQuestionInput,
  type PilotInstructionsChange,
  type PilotInstructionsImpact,
  type PilotQuestionStatus,
  pilotCycleDetailSchema,
  type UpdatePilotInstructionsInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import { type PilotState as PilotStateModel, PrismaClient } from "@/generated/prisma/client";
import { AGENDA_SNAPSHOT_RESET } from "./agenda/snapshot";
import { parseInstructionsConfig } from "./pilot.instructions";
import { toPilotQuestion, toPilotState } from "./pilot.mapper";
import { costByKind, countAppliedToday, countSentToday, countTodayOutcomes } from "./pilot.stats";

/** Expiring unanswered 2FA questions keeps their parked jobs from staying wedged. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

function questionExpiry(body: CreatePilotQuestionInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "2fa") return new Date(Date.now() + TWO_FA_TTL_MS);
  return null;
}

/** Owns Pilot state, instructions, activity reads, and question lifecycle. */
@singleton()
export class PilotService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  private async toStateDto(userId: string, row: PilotStateModel) {
    const config = parseInstructionsConfig(row.instructionsConfig);
    const now = new Date();
    const [appliedToday, networkingSentToday] = await Promise.all([
      countAppliedToday(this.prisma, userId, now),
      countSentToday(this.prisma, userId, now),
    ]);
    return toPilotState(row, appliedToday, networkingSentToday, config);
  }

  /** Create-on-first-read: every profile has exactly one PilotState, defaulted. */
  async getState(userId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toStateDto(userId, row);
  }

  private async readGoals(userId: string): Promise<string> {
    const row = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsGoals: true },
    });
    return row?.instructionsGoals ?? "";
  }

  /** What an instructions edit would leave running, so the user can decide before saving. */
  async instructionsImpact(userId: string): Promise<PilotInstructionsImpact> {
    const [searches, campaigns, approved] = await Promise.all([
      this.prisma.pilotSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, query: true, reason: true },
      }),
      this.prisma.campaign.findMany({
        where: { userId, createdBy: "pilot", status: "in_progress" },
        orderBy: { startedAt: "asc" },
        select: {
          campaignId: true,
          query: true,
          _count: { select: { jobs: { where: { status: "approved" } } } },
        },
      }),
      this.prisma.job.aggregate({
        where: { status: "approved", campaign: { userId, createdBy: "pilot" } },
        _count: { _all: true },
        _min: { createdAt: true },
      }),
    ]);

    return {
      searches,
      campaigns: campaigns.map((c) => ({
        campaignId: c.campaignId,
        query: c.query,
        approvedJobs: c._count.jobs,
      })),
      approvedJobs: approved._count._all,
      oldestApprovedAt: approved._min.createdAt,
    };
  }

  /**
   * Retires whatever the user chose to leave behind. Deleting the searches is what lets
   * `strategy.bootstrap` derive new ones from the new goals - it is gated on there being none - and
   * its own claim damper has to go with them or the next cycle skips it for a day.
   */
  private async applyInstructionsChange(userId: string, change: PilotInstructionsChange) {
    if (change.rederiveSearches) {
      await this.prisma.$transaction([
        this.prisma.pilotSearch.deleteMany({ where: { userId } }),
        this.prisma.pilotClaim.deleteMany({ where: { userId, kind: "strategy.bootstrap" } }),
      ]);
    }
    if (change.dropApprovedJobs) {
      await this.prisma.job.updateMany({
        where: { status: "approved", campaign: { userId, createdBy: "pilot" } },
        data: { status: "skipped", skipReason: "Goals changed before this was applied to." },
      });
    }
    if (change.completeCampaigns) {
      await this.prisma.campaign.updateMany({
        where: { userId, createdBy: "pilot", status: "in_progress" },
        data: {
          status: "completed",
          statusActor: "user",
          statusReason: "Goals changed.",
          completedAt: new Date(),
        },
      });
    }
  }

  async updateInstructions(userId: string, body: UpdatePilotInstructionsInput) {
    // The searches were chosen for the old goals - a change makes them all due and clears backoff.
    const goalsChanged = (await this.readGoals(userId)) !== body.goals;

    const instructions = {
      instructionsGoals: body.goals,
      instructionsConfig: body.config,
      instructionsUpdatedAt: new Date(),
      ...AGENDA_SNAPSHOT_RESET,
    };
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, ...instructions },
      update: instructions,
    });
    if (goalsChanged) {
      await this.prisma.pilotSearch.updateMany({
        where: { userId },
        data: { emptyRuns: 0, nextRunAt: new Date() },
      });
    }
    await this.applyInstructionsChange(userId, body.onChange);

    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  /** Start the loop. Goals are mandatory: the pilot has nothing to steer by without them. */
  async start(userId: string) {
    if ((await this.readGoals(userId)).trim() === "") {
      throw conflict("Write the pilot's goals before starting it.");
    }
    return this.setRunning(userId, true);
  }

  /** Stop the loop. Never guards - a stopped pilot injects zero cycles. */
  async stop(userId: string) {
    return this.setRunning(userId, false);
  }

  /** Clears run history only; instructions, searches and the running flag survive. */
  async reset(userId: string) {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.pilotJournalEntry.deleteMany({ where: { userId } });
      return tx.pilotState.upsert({
        where: { userId },
        create: { userId },
        update: { cycleCount: 0, lastCycleAt: null, ...AGENDA_SNAPSHOT_RESET },
      });
    });
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  private async setRunning(userId: string, running: boolean) {
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, running },
      update: { running, ...AGENDA_SNAPSHOT_RESET },
    });
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  /** Today's skipped/failed counts and bucketed skip reasons - the "why so few applies?" answer. */
  getTodayOutcomes(userId: string) {
    return countTodayOutcomes(this.prisma, userId, new Date());
  }

  /** Which agenda kinds ate the week - the ranking to tune the agent against. */
  async getCost(userId: string) {
    return { items: await costByKind(this.prisma, userId, new Date()) };
  }

  /** Newest persisted activity lets the terminal distinguish a slow live cycle from a stuck one. */
  async getActivity(userId: string) {
    // One read for the (few) unreleased claims covers both the newest claim timestamp and the count.
    const [claims, journalAgg, campaignAgg, jobAgg, cycleEntry, state] = await Promise.all([
      this.prisma.pilotClaim.findMany({
        where: { userId, releasedAt: null },
        select: { grantedAt: true, heartbeatAt: true, expiresAt: true },
      }),
      this.prisma.pilotJournalEntry.aggregate({ where: { userId }, _max: { createdAt: true } }),
      this.prisma.campaign.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      this.prisma.job.aggregate({ where: { campaign: { userId } }, _max: { updatedAt: true } }),
      this.prisma.pilotJournalEntry.findFirst({
        where: { userId, kind: "cycle" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { cycleId: true, createdAt: true, detail: true },
      }),
      this.prisma.pilotState.findUnique({ where: { userId }, select: { running: true } }),
    ]);

    const times = [
      ...claims.flatMap((c) => [c.grantedAt, c.heartbeatAt]),
      journalAgg._max.createdAt,
      campaignAgg._max.updatedAt,
      jobAgg._max.updatedAt,
    ];
    const lastActivityAt = times.reduce<Date | null>(
      (max, d) => (d != null && (max == null || d > max) ? d : max),
      null,
    );

    // Stall-recovery cycles routinely land with `detail: {}`, so missing fields null out here
    // rather than throwing - the host still needs `completedAt` off such an entry.
    const detail = cycleEntry && pilotCycleDetailSchema.safeParse(cycleEntry.detail).data;
    const lastCycle = cycleEntry
      ? {
          cycleId: cycleEntry.cycleId,
          completedAt: cycleEntry.createdAt,
          status: detail?.status ?? null,
          sleepSeconds: detail?.sleepSeconds ?? null,
        }
      : null;

    // Expired-but-unswept claims still count toward lastActivityAt but not as "active".
    const now = new Date();
    return {
      lastActivityAt,
      activeClaims: claims.filter((c) => c.expiresAt > now).length,
      // No row yet means the pilot was never started, so the host's gate must read it as stopped.
      running: state?.running ?? false,
      lastCycle,
    };
  }

  async createQuestion(userId: string, body: CreatePilotQuestionInput) {
    const expiresAt = questionExpiry(body);
    const row = await this.prisma.pilotQuestion.create({
      data: {
        userId,
        kind: body.kind === "2fa" ? "two_factor" : body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        prompt: body.prompt,
        options: body.options,
        deepLink: body.deepLink ?? null,
        expiresAt,
      },
    });
    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.created", question });
    // Fire-and-forget so a slow/failed push never delays the question write.
    void this.push.sendToUser(userId, {
      title: "JobPilot needs you",
      body: row.prompt,
      url: row.deepLink ?? "/pilot",
      tag: `question-${row.id}`,
    });
    return question;
  }

  /** Unpaginated: the attention panel wants every open question at once, and there are few. */
  async listQuestions(userId: string, status?: PilotQuestionStatus) {
    const rows = await this.prisma.pilotQuestion.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toPilotQuestion);
  }

  async answerQuestion(userId: string, id: string, body: AnswerPilotQuestionInput) {
    await findOwned(
      (where) => this.prisma.pilotQuestion.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Question",
    );

    // Status guard lives in the write: expiry publishes no SSE, so stale web cards and push
    // deep-links can still POST here - never resurrect an expired/cancelled question.
    const { count } = await this.prisma.pilotQuestion.updateMany({
      where: { id, userId, status: "open" },
      data: { status: "answered", answer: body.answer, answeredAt: new Date() },
    });
    if (count === 0) throw conflict("Question is no longer open.");

    const row = await findOwned(
      (where) => this.prisma.pilotQuestion.findFirst({ where }),
      { id, userId },
      "Question",
    );
    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.answered", question });
    return question;
  }
}
