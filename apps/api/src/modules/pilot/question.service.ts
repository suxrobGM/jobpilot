import type {
  AnswerPilotQuestionInput,
  CreatePilotQuestionInput,
  PilotQuestion,
  PilotQuestionStatus,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { z } from "zod/v4";
import { DAY_MS } from "@/common/date/buckets";
import { conflict, findOwned } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import { type PilotQuestion as PilotQuestionModel, PrismaClient } from "@/generated/prisma/client";
import { WebPushService } from "@/modules/web-push/web-push.service";
import { ProfileAnswerService } from "./answer.service";

/** An unanswered 2FA code is useless within minutes, and expiring it frees the job it parked. */
const TWO_FACTOR_TTL_MS = 5 * 60 * 1000;
/** Past this a question stops crowding Needs you, and the job it parked is skipped. */
const QUESTION_TTL_MS = 14 * DAY_MS;

/** A 2FA code or a per-job approval is never a reusable fact, whatever key the agent set. */
const SAVED_ANSWER_KINDS: PilotQuestionModel["kind"][] = ["question", "choice"];

export function toPilotQuestion(row: PilotQuestionModel): PilotQuestion {
  return { ...row, options: z.array(z.string()).parse(row.options) };
}

function questionExpiry(body: CreatePilotQuestionInput): Date {
  if (body.expiresAt) return new Date(body.expiresAt);
  const ttl = body.kind === "two_factor" ? TWO_FACTOR_TTL_MS : QUESTION_TTL_MS;
  return new Date(Date.now() + ttl);
}

@injectable()
export class PilotQuestionService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly push = inject(WebPushService),
    private readonly answers = inject(ProfileAnswerService),
  ) {}

  async createQuestion(userId: string, body: CreatePilotQuestionInput) {
    const row = await this.prisma.pilotQuestion.create({
      data: {
        userId,
        kind: body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        prompt: body.prompt,
        options: toInputJson(body.options),
        link: body.link ?? null,
        expiresAt: questionExpiry(body),
        savedAnswerKey: body.savedAnswerKey ?? null,
      },
    });
    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.created", question });
    void this.push.sendToUser(userId, {
      title: "JobPilot needs you",
      body: row.prompt,
      url: row.link ?? "/pilot",
      tag: `question-${row.id}`,
    });
    return question;
  }

  /** Unpaginated: the attention panel shows every open question, and there are few. */
  async listQuestions(userId: string, status?: PilotQuestionStatus) {
    const rows = await this.prisma.pilotQuestion.findMany({
      where: { userId, status },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toPilotQuestion);
  }

  async answerQuestion(userId: string, id: string, body: AnswerPilotQuestionInput) {
    // Expiry publishes no event, so a stale card or push link can still answer an expired question.
    const [row] = await this.prisma.pilotQuestion.updateManyAndReturn({
      where: { id, userId, status: "open" },
      data: { status: "answered", answer: body.answer, answeredAt: new Date() },
    });
    if (!row) {
      await findOwned(
        (where) => this.prisma.pilotQuestion.findFirst({ where }),
        { id, userId },
        "Question",
      );
      throw conflict("Question is no longer open.");
    }
    if (row.savedAnswerKey && SAVED_ANSWER_KINDS.includes(row.kind)) {
      await this.answers.save(userId, row.savedAnswerKey, body.answer);
    }

    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.answered", question });
    return question;
  }
}
