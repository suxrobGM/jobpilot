import type {
  AnswerPilotQuestionInput,
  CreatePilotQuestionInput,
  PilotQuestion,
  PilotQuestionStatus,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { z } from "zod/v4";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push/push.service";
import { publish } from "@/common/sse";
import { type PilotQuestion as PilotQuestionModel, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { ProfileAnswerService } from "./answer.service";
import { PilotJournalService } from "./journal.service";

/** An unanswered 2FA code is useless within minutes, and expiring it frees the job it parked. */
const TWO_FACTOR_TTL_MS = 5 * 60 * 1000;

export const USER_SKIP_REASON = "Skipped by you from Needs attention.";

/** A 2FA code or a per-job approval is never a reusable fact, whatever key the agent set. */
const SAVED_ANSWER_KINDS: PilotQuestionModel["kind"][] = ["question", "choice"];

function toPilotQuestion(row: PilotQuestionModel): PilotQuestion {
  return { ...row, options: z.array(z.string()).parse(row.options) };
}

/** A job question's subject id is `campaignId:key`; campaign ids are uuids, so the first colon splits. */
function questionJob(question: PilotQuestionModel): { campaignId: string; key: string } | null {
  if (question.subjectType !== "job" || !question.subjectId) return null;
  const split = question.subjectId.indexOf(":");
  if (split <= 0) return null;
  return {
    campaignId: question.subjectId.slice(0, split),
    key: question.subjectId.slice(split + 1),
  };
}

function expiryOf(body: CreatePilotQuestionInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "two_factor") return new Date(Date.now() + TWO_FACTOR_TTL_MS);
  return null;
}

@singleton()
export class PilotQuestionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
    private readonly answers: ProfileAnswerService,
    private readonly campaignJobs: CampaignJobService,
    private readonly journal: PilotJournalService,
  ) {}

  async createQuestion(userId: string, body: CreatePilotQuestionInput) {
    const row = await this.prisma.pilotQuestion.create({
      data: {
        userId,
        kind: body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        prompt: body.prompt,
        options: body.options,
        deepLink: body.deepLink ?? null,
        expiresAt: expiryOf(body),
        answerKey: body.answerKey ?? null,
      },
    });
    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.created", question });
    void this.push.sendToUser(userId, {
      title: "JobPilot needs you",
      body: row.prompt,
      url: row.deepLink ?? "/pilot",
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
    if (row.answerKey && SAVED_ANSWER_KINDS.includes(row.kind)) {
      await this.answers.save(userId, row.answerKey, body.answer);
    }

    const question = toPilotQuestion(row);
    publish(pilotChannel, { userId }, { type: "question.answered", question });
    return question;
  }

  /** Skips the question's job for good, recorded on the job and in the journal, and closes its questions. */
  async skipApplication(userId: string, id: string) {
    const question = await this.findOpenQuestion(userId, id);
    const job = questionJob(question);
    if (!job) throw conflict("This question is not about a job application.");

    const current = await findOwned(
      (where) =>
        this.prisma.job.findFirst({ where, select: { status: true, title: true, company: true } }),
      { campaignId: job.campaignId, key: job.key, campaign: { userId } },
      "Campaign job",
    );
    // The result write would race the worker that holds the job right now.
    if (current.status === "applying") {
      throw conflict("The pilot is applying to this job right now; try again once it parks.");
    }
    // Applied or already-skipped jobs keep their outcome; only the questions close. A failed job
    // is the one terminal result rewritten, since the failed-jobs retry sweep would pick it up again.
    const keepsOutcome = current.status === "applied" || current.status === "skipped";
    if (!keepsOutcome) {
      if (current.status === "failed") {
        await this.campaignJobs.skipFailedJob(userId, job.campaignId, job.key, USER_SKIP_REASON);
      } else {
        await this.campaignJobs.recordJobResult(userId, job.campaignId, job.key, {
          outcome: "skipped",
          skipReason: USER_SKIP_REASON,
        });
      }
      await this.journal.appendJournal(userId, {
        entries: [
          {
            kind: "action",
            subjectType: "job",
            subjectId: question.subjectId ?? undefined,
            summary: `You skipped ${current.title} at ${current.company} from Needs attention.`,
          },
        ],
      });
    }
    return this.closeSubjectQuestions(userId, question);
  }

  /** Dismisses the question and requeues a parked job so the pilot retries it without an answer. */
  async skipQuestion(userId: string, id: string) {
    const question = await this.findOpenQuestion(userId, id);
    const job = questionJob(question);
    if (job) {
      const current = await findOwned(
        (where) => this.prisma.job.findFirst({ where, select: { status: true } }),
        { campaignId: job.campaignId, key: job.key, campaign: { userId } },
        "Campaign job",
      );
      // Through patchJob, so the requeue obeys the same transition rules as the jobs table.
      if (current.status === "needs_user") {
        await this.campaignJobs.patchJob(userId, job.campaignId, job.key, { status: "approved" });
      }
    }
    return this.closeSubjectQuestions(userId, question);
  }

  private async findOpenQuestion(userId: string, id: string) {
    const question = await findOwned(
      (where) => this.prisma.pilotQuestion.findFirst({ where }),
      { id, userId },
      "Question",
    );
    if (question.status !== "open") throw conflict("Question is no longer open.");
    return question;
  }

  /** Cancels this question and any sibling still open on the same subject - they share one fate. */
  private async closeSubjectQuestions(userId: string, question: PilotQuestionModel) {
    const sameSubject = question.subjectId
      ? { subjectType: question.subjectType, subjectId: question.subjectId }
      : { id: question.id };
    const closed = await this.prisma.pilotQuestion.updateManyAndReturn({
      where: { userId, status: "open", OR: [{ id: question.id }, sameSubject] },
      data: { status: "cancelled" },
    });
    for (const row of closed) {
      publish(
        pilotChannel,
        { userId },
        { type: "question.closed", question: toPilotQuestion(row) },
      );
    }
    const own = closed.find((row) => row.id === question.id);
    if (!own) throw conflict("Question is no longer open.");
    return toPilotQuestion(own);
  }
}
