import { cursorPage } from "@jobpilot/contracts/pagination";
import type {
  PilotChange,
  PilotMessage,
  PilotQuestion,
  PilotRequest,
  PilotThreadItem,
  PilotThreadPage,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import type { JobRef } from "@/modules/feed/jobs/applying";
import { toPilotChange } from "../changes/change-row";
import { jobSubjectId, parseJobSubject } from "../job-subject";
import { toPilotQuestion } from "../questions/question-row";
import { toPilotRequest } from "../requests/request-row";
import {
  type DiscoveredJob,
  foldWork,
  type QuestionJobs,
  type ThreadJobs,
  type ThreadRunRow,
  threadJobRefs,
  toRunLine,
} from "./thread-work";

/** Questions, drafts and changes per page; bounds the oldest page, which has no lower time bound. */
const SIDE_ROWS_CAP = 100;

const THREAD_RUN_SELECT = {
  id: true,
  taskType: true,
  subjectType: true,
  subjectId: true,
  title: true,
  summary: true,
  outcome: true,
  startedAt: true,
  finishedAt: true,
  payload: true,
} satisfies Prisma.PilotRunSelect;

interface ThreadSources {
  runs: ThreadRunRow[];
  questionJobs: QuestionJobs;
  jobs: ThreadJobs;
  discovered: DiscoveredJob[];
  questions: PilotQuestion[];
  changes: PilotChange[];
  messages: PilotMessage[];
  requests: ThreadRequest[];
}

/** A request with the job it named, when it named one. */
interface ThreadRequest {
  request: PilotRequest;
  jobSubject: string | null;
}

/** Merges one page of runs with the questions, messages and changes from the same span, newest first. */
export function buildThread(sources: ThreadSources): PilotThreadItem[] {
  const lines = sources.runs.map((run) => toRunLine(run, sources.jobs, sources.questionJobs));
  const items = foldWork(lines, sources.jobs, sources.discovered);
  for (const question of sources.questions) {
    items.push({ type: "question", id: question.id, at: question.createdAt, question });
  }
  for (const message of sources.messages) {
    items.push({ type: "message", id: message.id, at: message.createdAt, message });
  }
  for (const { request, jobSubject } of sources.requests) {
    const job = jobSubject ? (sources.jobs.get(jobSubject)?.job ?? null) : null;
    items.push({ type: "request", id: request.id, at: request.createdAt, request, job });
  }
  for (const change of sources.changes) {
    items.push({ type: "change", id: change.id, at: change.createdAt, change });
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

@injectable()
export class PilotThreadService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async getPage(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<PilotThreadPage> {
    // Runs that closed without a result line (cancelled, expired) never show.
    const where = { userId, finishedAt: { not: null }, summary: { not: null } };
    const [rows, cursorRow] = await Promise.all([
      this.prisma.pilotRun.findMany({
        where,
        orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
        select: THREAD_RUN_SELECT,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      cursor
        ? this.prisma.pilotRun.findFirst({
            where: { id: cursor, userId },
            select: { finishedAt: true },
          })
        : null,
    ]);
    const { items: runs, nextCursor } = cursorPage(rows, limit);

    // The page's span: older than the previous page's last run, back to this page's oldest.
    const upper = cursorRow?.finishedAt ?? undefined;
    const lower = nextCursor ? (runs.at(-1)?.finishedAt ?? undefined) : undefined;
    const createdAt = { lt: upper, gte: lower };
    const sideRows = {
      where: { userId, createdAt },
      orderBy: { createdAt: "desc" as const },
      take: SIDE_ROWS_CAP,
    };

    const [questionJobs, questions, changes, messages, requests] = await Promise.all([
      this.loadQuestionJobs(userId, runs),
      this.prisma.pilotQuestion.findMany(sideRows),
      this.prisma.pilotChange.findMany(sideRows),
      this.prisma.pilotMessage.findMany(sideRows),
      this.prisma.pilotRequest.findMany(sideRows),
    ]);

    const requestJobs = requests.flatMap((row) =>
      row.subjectType === "job" ? [row.subjectId] : [],
    );
    const [jobs, discovered] = await Promise.all([
      this.loadJobs(userId, [
        ...threadJobRefs(runs, questionJobs),
        ...requestJobs.map(parseJobSubject),
      ]),
      this.loadDiscovered(userId, runs),
    ]);
    const items = buildThread({
      runs,
      questionJobs,
      jobs,
      discovered,
      questions: questions.map(toPilotQuestion),
      changes: changes.map((row) => toPilotChange(row)),
      messages,
      requests: requests.map((row) => ({
        request: toPilotRequest(row),
        jobSubject: row.subjectType === "job" ? row.subjectId : null,
      })),
    });
    return { items, nextCursor };
  }

  private async loadQuestionJobs(userId: string, runs: ThreadRunRow[]): Promise<QuestionJobs> {
    const ids = runs.flatMap((run) =>
      run.taskType === "question.answered" ? [run.subjectId] : [],
    );
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.pilotQuestion.findMany({
      where: { userId, id: { in: ids }, subjectType: "job" },
      select: { id: true, subjectId: true },
    });
    return new Map(rows.flatMap((row) => (row.subjectId ? [[row.id, row.subjectId]] : [])));
  }

  private async loadJobs(userId: string, refs: JobRef[]): Promise<ThreadJobs> {
    if (refs.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.job.findMany({
      where: { userId, OR: refs.map((ref) => ({ feedId: ref.feedId, key: ref.key })) },
      select: {
        id: true,
        feedId: true,
        key: true,
        title: true,
        company: true,
        matchScore: true,
        status: true,
        appliedAt: true,
        applications: { select: { id: true }, take: 1 },
      },
    });
    return new Map(
      rows.map((row) => [
        jobSubjectId(row),
        {
          job: {
            id: row.id,
            title: row.title,
            company: row.company,
            score: row.matchScore,
            status: row.status,
            applicationId: row.applications[0]?.id ?? null,
          },
          appliedAt: row.appliedAt,
        },
      ]),
    );
  }

  /** Jobs created by the page's search runs, over the span those runs cover. */
  private async loadDiscovered(userId: string, runs: ThreadRunRow[]): Promise<DiscoveredJob[]> {
    const searches = runs.filter((run) => run.taskType === "search.discover" && run.finishedAt);
    if (searches.length === 0) {
      return [];
    }
    const feedIds = [...new Set(searches.flatMap((run) => (run.subjectId ? [run.subjectId] : [])))];
    const from = Math.min(...searches.map((run) => run.startedAt.getTime()));
    const to = Math.max(...searches.map((run) => run.finishedAt?.getTime() ?? from));
    return this.prisma.job.findMany({
      where: {
        userId,
        feedId: { in: feedIds },
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      select: { feedId: true, createdAt: true },
    });
  }
}
