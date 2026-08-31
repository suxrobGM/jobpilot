import type {
  AnswerPilotQuestionInput,
  CreatePilotQuestionInput,
  PilotQuestionStatus,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { toPilotQuestion } from "./pilot.mapper";

/** Expiring unanswered 2FA questions keeps their parked jobs from staying wedged. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

function questionExpiry(body: CreatePilotQuestionInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "2fa") return new Date(Date.now() + TWO_FA_TTL_MS);
  return null;
}

/** Owns the question lifecycle: open, list, answer. */
@singleton()
export class PilotQuestionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  async createQuestion(userId: string, body: CreatePilotQuestionInput) {
    const row = await this.prisma.pilotQuestion.create({
      data: {
        userId,
        kind: body.kind === "2fa" ? "two_factor" : body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        prompt: body.prompt,
        options: body.options,
        deepLink: body.deepLink ?? null,
        expiresAt: questionExpiry(body),
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
