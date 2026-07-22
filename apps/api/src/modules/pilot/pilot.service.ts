import {
  type AnswerPilotQuestionInput,
  type CreatePilotQuestionInput,
  type PilotQuestionStatus,
  pilotCycleDetailSchema,
  type SetPilotEnabledInput,
  type UpdatePilotInstructionsInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import {
  type PilotState as PilotStateModel,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { parseInstructionsConfig } from "./pilot.instructions";
import { toPilotQuestion, toPilotState } from "./pilot.mapper";
import { countAppliedToday } from "./pilot.stats";

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
    const appliedToday = await countAppliedToday(this.prisma, userId, new Date());
    return toPilotState(row, appliedToday, config);
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

  async updateInstructions(userId: string, body: UpdatePilotInstructionsInput) {
    // Goals are the pilot's whole steering input, so a change makes every search due for a fresh
    // pass and clears its backoff - the searches were chosen for the old goals.
    const prev = await this.prisma.pilotState.findUnique({
      where: { userId },
      select: { instructionsGoals: true },
    });
    const goalsChanged = (prev?.instructionsGoals ?? "") !== body.goals;

    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: {
        userId,
        instructionsGoals: body.goals,
        instructionsConfig: body.config,
        instructionsUpdatedAt: new Date(),
        agendaVersion: null,
        agendaGeneratedAt: null,
        agendaExpiresAt: null,
        agendaSnapshot: Prisma.DbNull,
      },
      update: {
        instructionsGoals: body.goals,
        instructionsConfig: body.config,
        instructionsUpdatedAt: new Date(),
        agendaVersion: null,
        agendaGeneratedAt: null,
        agendaExpiresAt: null,
        agendaSnapshot: Prisma.DbNull,
      },
    });
    if (goalsChanged) {
      await this.prisma.pilotSearch.updateMany({
        where: { userId },
        data: { emptyRuns: 0, nextRunAt: new Date() },
      });
    }
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  async setEnabled(userId: string, body: SetPilotEnabledInput) {
    // Goals are mandatory to start: the pilot has nothing to steer by without them. Stopping never guards.
    // (Guard moves to `start` in a later milestone.)
    if (body.enabled) {
      const prev = await this.prisma.pilotState.findUnique({
        where: { userId },
        select: { instructionsGoals: true },
      });
      if ((prev?.instructionsGoals ?? "").trim() === "") {
        throw conflict("Write the pilot's goals before starting it.");
      }
    }
    const row = await this.prisma.pilotState.upsert({
      where: { userId },
      create: { userId, enabled: body.enabled },
      update: {
        enabled: body.enabled,
        agendaVersion: null,
        agendaGeneratedAt: null,
        agendaExpiresAt: null,
        agendaSnapshot: Prisma.DbNull,
      },
    });
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  /** Newest persisted activity lets the terminal distinguish a slow live cycle from a stuck one. */
  async getActivity(userId: string) {
    // One read for the (few) unreleased claims covers both the newest claim timestamp and the count.
    const [claims, journalAgg, campaignAgg, jobAgg, cycleEntry] = await Promise.all([
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
