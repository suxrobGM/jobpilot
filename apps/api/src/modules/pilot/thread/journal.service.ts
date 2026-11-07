import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import {
  type CreatePilotJournalInput,
  type PilotJournalKind,
  tokenUsage,
} from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { type PilotJournalEntry, PrismaClient } from "@/generated/prisma/client";
import { WebPushService } from "@/modules/web-push/web-push.service";
import {
  publishJournalEntries,
  type RunsById,
  toJournalEntry,
  writeJournalEntries,
} from "./journal-entries";

const EXPORT_BATCH = 500;

/** Every entry a run journals carries its `runId`, so one read covers a page. */
async function loadRuns(
  prisma: Pick<PrismaClient, "pilotRun">,
  userId: string,
  rows: PilotJournalEntry[],
): Promise<RunsById> {
  const runIds = [...new Set(rows.flatMap((row) => (row.runId ? [row.runId] : [])))];
  if (runIds.length === 0) {
    return new Map();
  }
  const runs = await prisma.pilotRun.findMany({
    where: { userId, id: { in: runIds } },
    select: {
      id: true,
      taskType: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
  });
  return new Map(
    runs.map((run) => [
      run.id,
      { taskType: run.taskType, tokens: run.model === null ? null : tokenUsage(run) },
    ]),
  );
}

@injectable()
export class PilotJournalService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly push = inject(WebPushService),
  ) {}

  async append(userId: string, body: CreatePilotJournalInput) {
    const rows = await this.prisma.$transaction((tx) => writeJournalEntries(tx, userId, body));
    return { items: await this.publishAppended(userId, rows) };
  }

  /** After the entries commit: stream them and push alerts. */
  async publishAppended(userId: string, rows: PilotJournalEntry[]) {
    const items = publishJournalEntries(userId, rows, await loadRuns(this.prisma, userId, rows));
    // The host journals orchestrator failures as system entries; push them so they reach the phone.
    for (const entry of items.filter((item) => item.kind === "system")) {
      void this.push.sendToUser(userId, {
        title: "Pilot alert",
        body: entry.summary,
        url: "/pilot",
        tag: "pilot-system",
      });
    }
    return items;
  }

  async list(userId: string, query: PaginationQuery, kinds?: PilotJournalKind[]) {
    const where = { userId, kind: kinds?.length ? { in: kinds } : undefined };
    const [rows, total] = await Promise.all([
      this.prisma.pilotJournalEntry.findMany({
        where,
        // Batch appends share one createdAt, so id keeps their order stable across pages.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageSlice(query),
      }),
      this.prisma.pilotJournalEntry.count({ where }),
    ]);
    const runs = await loadRuns(this.prisma, userId, rows);
    return paginate(
      rows.map((row) => toJournalEntry(row, runs)),
      query,
      total,
    );
  }

  /** Oldest first, read in batches so the journal is never all in memory. */
  streamExport(userId: string): Response {
    const { prisma } = this;
    const encoder = new TextEncoder();
    let cursor: string | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const rows = await prisma.pilotJournalEntry.findMany({
          where: { userId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: EXPORT_BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (rows.length === 0) {
          controller.close();
          return;
        }
        const runs = await loadRuns(prisma, userId, rows);
        for (const row of rows) {
          controller.enqueue(encoder.encode(`${JSON.stringify(toJournalEntry(row, runs))}\n`));
        }
        cursor = rows[rows.length - 1].id;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson",
        "content-disposition": 'attachment; filename="pilot-journal.ndjson"',
      },
    });
  }
}
