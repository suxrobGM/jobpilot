import type {
  AnswerQuestionInput,
  CreateQuestionInput,
  QuestionStatus,
  SetPilotEnabledInput,
  UpdatePilotInstructionsInput,
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
import { toPilotState, toQuestion } from "./pilot.mapper";
import { countAppliedToday } from "./pilot.stats";

/** Expiring unanswered 2FA questions keeps their parked jobs from staying wedged. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

function questionExpiry(body: CreateQuestionInput): Date | null {
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
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  async setEnabled(userId: string, body: SetPilotEnabledInput) {
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

  /** Newest persisted activity lets the terminal distinguish a slow live cycle from a stall. */
  async getActivity(userId: string) {
    // One read for the (few) unreleased leases covers both the newest lease timestamp and the count.
    const [leases, journalAgg, campaignAgg, jobAgg] = await Promise.all([
      this.prisma.pilotLease.findMany({
        where: { userId, releasedAt: null },
        select: { grantedAt: true, heartbeatAt: true, expiresAt: true },
      }),
      this.prisma.pilotJournalEntry.aggregate({ where: { userId }, _max: { createdAt: true } }),
      this.prisma.campaign.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      this.prisma.job.aggregate({ where: { campaign: { userId } }, _max: { updatedAt: true } }),
    ]);

    const times = [
      ...leases.flatMap((l) => [l.grantedAt, l.heartbeatAt]),
      journalAgg._max.createdAt,
      campaignAgg._max.updatedAt,
      jobAgg._max.updatedAt,
    ];
    const lastActivityAt = times.reduce<Date | null>(
      (max, d) => (d != null && (max == null || d > max) ? d : max),
      null,
    );

    // Expired-but-unswept leases still count toward lastActivityAt but not as "active".
    const now = new Date();
    return { lastActivityAt, activeLeases: leases.filter((l) => l.expiresAt > now).length };
  }

  async createQuestion(userId: string, body: CreateQuestionInput) {
    const expiresAt = questionExpiry(body);
    const row = await this.prisma.question.create({
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
    const question = toQuestion(row);
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

  async listQuestions(userId: string, status?: QuestionStatus) {
    const rows = await this.prisma.question.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toQuestion);
  }

  async answerQuestion(userId: string, id: string, body: AnswerQuestionInput) {
    await findOwned(
      (where) => this.prisma.question.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Question",
    );

    // Status guard lives in the write: expiry publishes no SSE, so stale web cards and push
    // deep-links can still POST here - never resurrect an expired/cancelled question.
    const { count } = await this.prisma.question.updateMany({
      where: { id, userId, status: "open" },
      data: { status: "answered", answer: body.answer, answeredAt: new Date() },
    });
    if (count === 0) throw conflict("Question is no longer open.");

    const row = await findOwned(
      (where) => this.prisma.question.findFirst({ where }),
      { id, userId },
      "Question",
    );
    const question = toQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.answered", question });
    return question;
  }
}
