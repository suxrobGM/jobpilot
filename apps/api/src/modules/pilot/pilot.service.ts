import type {
  AnswerQuestionInput,
  CreateQuestionInput,
  QuestionStatus,
  SetPilotEnabledInput,
  UpdatePilotInstructionsInput,
} from "@jobpilot/contracts/pilot";
import { pilotInstructionsConfigSchema } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import { type PilotState as PilotStateModel, PrismaClient } from "@/generated/prisma/client";
import { toPilotState, toQuestion } from "./pilot.mapper";
import { countAppliedToday } from "./pilot.stats";

/** 2FA codes die within minutes, so an unanswered 2FA question must self-expire fast; the agenda
 *  expiry sweep then cleanly skips the parked job instead of leaving it wedged in needs_user. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

function questionExpiry(body: CreateQuestionInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "2fa") return new Date(Date.now() + TWO_FA_TTL_MS);
  return null;
}

@singleton()
export class PilotService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  // ── State / instructions ──────────────────────────────────────────────────────

  /**
   * Full state DTO shared by every state-returning route: the persisted row plus
   * today's applied count (UTC day).
   */
  private async toStateDto(userId: string, row: PilotStateModel) {
    const config = pilotInstructionsConfigSchema.parse(JSON.parse(row.instructionsConfig));
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
        instructionsConfig: JSON.stringify(body.config),
        instructionsUpdatedAt: new Date(),
      },
      update: {
        instructionsGoals: body.goals,
        instructionsConfig: JSON.stringify(body.config),
        instructionsUpdatedAt: new Date(),
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
      update: { enabled: body.enabled },
    });
    const state = await this.toStateDto(userId, row);
    publish(pilotChannel, { userId }, { type: "state.changed", state });
    return state;
  }

  /**
   * Server-side liveness for the terminal watchdog: the newest agent activity across leases, the
   * journal, campaign writes, and job *creation*, plus the current active-lease count. Lets the host
   * tell a live long cycle (a slow apply, a heartbeating worker) from a real stall before it climbs
   * the nudge/kill ladder. Job status transitions are invisible here - Job has no `updatedAt` column -
   * but every one of them bumps its campaign's `updatedAt` via the summary recompute, and a worker
   * mid-apply heartbeats its lease, so both paths are still covered.
   */
  async getActivity(userId: string) {
    // One read for the (few) unreleased leases covers both the newest lease timestamp and the count.
    const [leases, journalAgg, campaignAgg, jobAgg] = await Promise.all([
      this.prisma.pilotLease.findMany({
        where: { userId, releasedAt: null },
        select: { grantedAt: true, heartbeatAt: true, expiresAt: true },
      }),
      this.prisma.pilotJournalEntry.aggregate({ where: { userId }, _max: { createdAt: true } }),
      this.prisma.campaign.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      this.prisma.job.aggregate({ where: { campaign: { userId } }, _max: { createdAt: true } }),
    ]);

    const times = [
      ...leases.flatMap((l) => [l.grantedAt, l.heartbeatAt]),
      journalAgg._max.createdAt,
      campaignAgg._max.updatedAt,
      jobAgg._max.createdAt,
    ];
    const lastActivityAt = times.reduce<Date | null>(
      (max, d) => (d != null && (max == null || d > max) ? d : max),
      null,
    );

    // Expired-but-unswept leases still count toward lastActivityAt but not as "active".
    const now = new Date();
    return { lastActivityAt, activeLeases: leases.filter((l) => l.expiresAt > now).length };
  }

  // ── Questions ─────────────────────────────────────────────────────────────────

  async createQuestion(userId: string, body: CreateQuestionInput) {
    const expiresAt = questionExpiry(body);
    const row = await this.prisma.question.create({
      data: {
        userId,
        kind: body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        prompt: body.prompt,
        options: JSON.stringify(body.options),
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
