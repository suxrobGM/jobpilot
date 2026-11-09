import { pageSlice, paginate } from "@jobpilot/contracts/pagination";
import {
  type PilotRunHistoryItem,
  type PilotRunHistoryQuery,
  tokenUsage,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

const EXPORT_BATCH = 500;

const HISTORY_SELECT = {
  id: true,
  taskType: true,
  title: true,
  outcome: true,
  summary: true,
  finishedAt: true,
  model: true,
  inputTokens: true,
  outputTokens: true,
  cacheReadTokens: true,
  cacheWriteTokens: true,
} satisfies Prisma.PilotRunSelect;

type HistoryRow = Prisma.PilotRunGetPayload<{ select: typeof HISTORY_SELECT }>;

function toHistoryItem(row: HistoryRow): PilotRunHistoryItem | null {
  const { outcome, finishedAt } = row;
  if (outcome === null || finishedAt === null) {
    return null;
  }
  return {
    id: row.id,
    taskType: row.taskType,
    title: row.title,
    outcome,
    summary: row.summary,
    finishedAt,
    tokens: row.model === null ? null : tokenUsage(row),
  };
}

function finishedWhere(userId: string, query?: PilotRunHistoryQuery): Prisma.PilotRunWhereInput {
  const outcomes = query?.outcomes;
  return {
    userId,
    finishedAt: { not: null },
    outcome: outcomes?.length ? { in: outcomes } : { not: null },
  };
}

/** Finished runs for Diagnostics: a page, or every one as NDJSON. */
@injectable()
export class RunListService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async list(userId: string, query: PilotRunHistoryQuery) {
    const where = finishedWhere(userId, query);
    const [rows, total] = await Promise.all([
      this.prisma.pilotRun.findMany({
        where,
        orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
        select: HISTORY_SELECT,
        ...pageSlice(query),
      }),
      this.prisma.pilotRun.count({ where }),
    ]);
    const items = rows.flatMap((row) => toHistoryItem(row) ?? []);
    return paginate(items, query, total);
  }

  /** Oldest first, read in batches so the history is never all in memory. */
  streamExport(userId: string): Response {
    const { prisma } = this;
    const encoder = new TextEncoder();
    let cursor: string | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const rows = await prisma.pilotRun.findMany({
          where: finishedWhere(userId),
          orderBy: [{ finishedAt: "asc" }, { id: "asc" }],
          select: HISTORY_SELECT,
          take: EXPORT_BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (rows.length === 0) {
          controller.close();
          return;
        }
        for (const row of rows) {
          const item = toHistoryItem(row);
          if (item) {
            controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
          }
        }
        cursor = rows[rows.length - 1].id;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson",
        "content-disposition": 'attachment; filename="pilot-runs.ndjson"',
      },
    });
  }
}
