import { cursorPage } from "@jobpilot/contracts/pagination";
import type {
  PilotChange,
  PilotJournalKind,
  PilotMessage,
  PilotQuestion,
  PilotRequest,
  PilotThreadItem,
  PilotThreadPage,
  PilotThreadRun,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import {
  type PilotJournalEntry as PilotJournalEntryModel,
  type PilotRun as PilotRunModel,
  PrismaClient,
} from "@/generated/prisma/client";
import { toPilotChange } from "../changes/change-row";
import { toPilotQuestion } from "../questions/question.service";
import { toPilotRequest } from "../requests/request-row";
import { toJournalEntry } from "./journal-entries";

/** Cycle entries are the loop's bookkeeping; questions arrive as their own rows. */
const THREAD_KINDS: PilotJournalKind[] = ["action", "digest", "system", "correction"];

/** Runs closer together than this read as one sitting of work. */
const WORK_GAP_MS = 20 * 60 * 1000;

/** Questions, drafts and changes per page; bounds the oldest page, which has no lower time bound. */
const SIDE_ROWS_CAP = 100;

type ThreadRunRow = Pick<
  PilotRunModel,
  "id" | "taskType" | "subjectType" | "subjectId" | "title" | "outcome" | "startedAt" | "finishedAt"
>;

interface ThreadSources {
  entries: PilotJournalEntryModel[];
  runs: ThreadRunRow[];
  questions: PilotQuestion[];
  changes: PilotChange[];
  messages: PilotMessage[];
  requests: PilotRequest[];
}

interface TimedRun {
  line: PilotThreadRun;
  startedAt: Date;
}

/** The run's line, from entries oldest first: its newest action entry is the result summary `postResult` journals. */
function toRunLine(run: ThreadRunRow, entries: PilotJournalEntryModel[]): TimedRun {
  const newest = entries[entries.length - 1];
  const result = entries.filter((entry) => entry.kind === "action").at(-1) ?? newest;
  return {
    startedAt: run.startedAt,
    line: {
      runId: run.id,
      taskType: run.taskType,
      title: run.title,
      summary: result.summary,
      outcome: run.outcome,
      subjectType: result.subjectType ?? run.subjectType,
      subjectId: result.subjectId ?? run.subjectId,
      finishedAt: run.finishedAt ?? newest.createdAt,
    },
  };
}

function foldWork(runs: TimedRun[]): PilotThreadItem[] {
  const sorted = [...runs].sort(
    (a, b) => a.line.finishedAt.getTime() - b.line.finishedAt.getTime(),
  );
  const blocks: TimedRun[][] = [];
  for (const run of sorted) {
    const block = blocks.at(-1);
    const last = block?.at(-1);
    const gap = last ? run.line.finishedAt.getTime() - last.line.finishedAt.getTime() : null;
    if (block && gap !== null && gap < WORK_GAP_MS) {
      block.push(run);
    } else {
      blocks.push([run]);
    }
  }
  return blocks.map((block) => {
    const startedAt = new Date(Math.min(...block.map((run) => run.startedAt.getTime())));
    const endedAt = block[block.length - 1].line.finishedAt;
    return {
      type: "work",
      id: block[0].line.runId,
      at: endedAt,
      startedAt,
      endedAt,
      runs: block.map((run) => run.line),
    };
  });
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
    return toRunLine(run, ordered);
  });
  items.push(...foldWork(runs));
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

  async getThread(
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
            },
          }),
      this.prisma.pilotQuestion.findMany(sideRows),
      this.prisma.pilotChange.findMany(sideRows),
      this.prisma.pilotMessage.findMany(sideRows),
      this.prisma.pilotRequest.findMany(sideRows),
    ]);

    const items = buildThread({
      entries,
      runs,
      questions: questions.map(toPilotQuestion),
      changes: changes.map((row) => toPilotChange(row)),
      messages,
      requests: requests.map(toPilotRequest),
    });
    return { items, nextCursor };
  }
}
