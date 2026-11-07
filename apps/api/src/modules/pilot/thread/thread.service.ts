import { cursorPage } from "@jobpilot/contracts/pagination";
import type {
  PilotChange,
  PilotJournalKind,
  PilotMessage,
  PilotQuestion,
  PilotRequest,
  PilotThreadItem,
  PilotThreadPage,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import {
  type PilotJournalEntry as PilotJournalEntryModel,
  PrismaClient,
} from "@/generated/prisma/client";
import type { JobRef } from "@/modules/feed/jobs/applying";
import { toPilotChange } from "../changes/change-row";
import { jobSubjectId } from "../job-subject";
import { toPilotQuestion } from "../questions/question-row";
import { toPilotRequest } from "../requests/request-row";
import { toJournalEntry } from "./journal-entries";
import {
  type DiscoveredJob,
  foldWork,
  type ThreadJobs,
  type ThreadRunRow,
  threadJobRefs,
  toRunLine,
} from "./thread-work";

/** Cycle entries are the loop's bookkeeping; questions arrive as their own rows. */
const THREAD_KINDS: PilotJournalKind[] = ["action", "digest", "system", "correction"];

/** Questions, drafts and changes per page; bounds the oldest page, which has no lower time bound. */
const SIDE_ROWS_CAP = 100;

interface ThreadSources {
  entries: PilotJournalEntryModel[];
  runs: ThreadRunRow[];
  jobs: ThreadJobs;
  discovered: DiscoveredJob[];
  questions: PilotQuestion[];
  changes: PilotChange[];
  messages: PilotMessage[];
  requests: PilotRequest[];
}

/** Merges one page of journal entries with the questions and drafts from the same span, newest first. */
export function buildThread(sources: ThreadSources): PilotThreadItem[] {
  const runsById = new Map(sources.runs.map((run) => [run.id, run]));
  const entriesByRun = new Map<ThreadRunRow, PilotJournalEntryModel[]>();
  const items: PilotThreadItem[] = [];

  for (const row of sources.entries) {
    const run = row.runId ? runsById.get(row.runId) : undefined;
    if (run && row.kind !== "digest") {
      const entries = entriesByRun.get(run);
      if (entries) entries.push(row);
      else entriesByRun.set(run, [row]);
    } else {
      items.push({
        type: row.kind === "digest" ? "digest" : "note",
        id: row.id,
        at: row.createdAt,
        entry: toJournalEntry(row, new Map()),
      });
    }
  }

  const runs = [...entriesByRun].map(([run, entries]) => {
    const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return toRunLine(run, ordered, sources.jobs);
  });
  items.push(...foldWork(runs, sources.jobs, sources.discovered));
  for (const question of sources.questions) {
    items.push({ type: "question", id: question.id, at: question.createdAt, question });
  }
  for (const message of sources.messages) {
    items.push({ type: "message", id: message.id, at: message.createdAt, message });
  }
  for (const request of sources.requests) {
    items.push({ type: "request", id: request.id, at: request.createdAt, request });
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
    const [rows, cursorRow] = await Promise.all([
      this.prisma.pilotJournalEntry.findMany({
        where: { userId, kind: { in: THREAD_KINDS } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      cursor
        ? this.prisma.pilotJournalEntry.findFirst({
            where: { id: cursor, userId },
            select: { createdAt: true },
          })
        : null,
    ]);
    const { items: entries, nextCursor } = cursorPage(rows, limit);

    // The page's span: older than the previous page's last entry, back to this page's oldest.
    const upper = cursorRow?.createdAt;
    const lower = nextCursor ? entries.at(-1)?.createdAt : undefined;
    const createdAt = { lt: upper, gte: lower };
    const sideRows = {
      where: { userId, createdAt },
      orderBy: { createdAt: "desc" as const },
      take: SIDE_ROWS_CAP,
    };
    const runIds = [...new Set(entries.flatMap((entry) => (entry.runId ? [entry.runId] : [])))];

    const [runs, questions, changes, messages, requests] = await Promise.all([
      runIds.length === 0
        ? []
        : this.prisma.pilotRun.findMany({
            where: { userId, id: { in: runIds } },
            select: {
              id: true,
              taskType: true,
              subjectType: true,
              subjectId: true,
              title: true,
              outcome: true,
              startedAt: true,
              finishedAt: true,
              payload: true,
            },
          }),
      this.prisma.pilotQuestion.findMany(sideRows),
      this.prisma.pilotChange.findMany(sideRows),
      this.prisma.pilotMessage.findMany(sideRows),
      this.prisma.pilotRequest.findMany(sideRows),
    ]);

    const [jobs, discovered] = await Promise.all([
      this.loadJobs(userId, threadJobRefs(runs, entries)),
      this.loadDiscovered(userId, runs),
    ]);
    const items = buildThread({
      entries,
      runs,
      jobs,
      discovered,
      questions: questions.map(toPilotQuestion),
      changes: changes.map((row) => toPilotChange(row)),
      messages,
      requests: requests.map(toPilotRequest),
    });
    return { items, nextCursor };
  }

  private async loadJobs(userId: string, refs: JobRef[]): Promise<ThreadJobs> {
    if (refs.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.job.findMany({
      where: { userId, OR: refs.map((ref) => ({ feedId: ref.feedId, key: ref.key })) },
      select: { feedId: true, key: true, title: true, company: true, matchScore: true },
    });
    return new Map(
      rows.map((row) => [
        jobSubjectId(row),
        { title: row.title, company: row.company, score: row.matchScore },
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
