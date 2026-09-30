import type {
  AnswerPilotQuestionInput,
  CreatePilotQuestionInput,
  PilotQuestionStatus,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned } from "@/common/errors";
import { PushService } from "@/common/push/push.service";
import { publish } from "@/common/sse";
import { type PilotQuestion as PilotQuestionRow, PrismaClient } from "@/generated/prisma/client";
import { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { PilotJournalService } from "./journal.service";
import { toPilotQuestion } from "./pilot.mapper";

/** Expiring unanswered 2FA questions keeps their parked jobs from staying wedged. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

export const USER_SKIP_REASON = "Skipped by you from Needs attention.";

/** A job question's subject id is `campaignId:key`; campaign ids are uuids, so the first colon splits. */
function parseJobSubject(question: PilotQuestionRow): { campaignId: string; key: string } | null {
  if (question.subjectType !== "job" || !question.subjectId) return null;
  const split = question.subjectId.indexOf(":");
  if (split <= 0) return null;
  return {
    campaignId: question.subjectId.slice(0, split),
    key: question.subjectId.slice(split + 1),
  };
}

function questionExpiry(body: CreatePilotQuestionInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "two_factor") return new Date(Date.now() + TWO_FA_TTL_MS);
  return null;
}

/** Owns the question lifecycle: open, list, answer. */
@singleton()
export class PilotQuestionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
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

  /** Skips the question's job for good, recorded on the job and in the journal, and closes its questions. */
  async skipApplication(userId: string, id: string) {
    const question = await this.findOpenQuestion(userId, id);
    const job = parseJobSubject(question);
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
    const job = parseJobSubject(question);
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
  private async closeSubjectQuestions(userId: string, question: PilotQuestionRow) {
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
