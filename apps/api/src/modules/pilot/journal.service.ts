import { cursorPage } from "@jobpilot/contracts/pagination";
import type { CreatePilotJournalInput, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { singleton } from "tsyringe";
import { publishActivity, toActivityEntry, writeActivity } from "@/common/activity-log";
import { PushService } from "@/common/push/push.service";
import { PrismaClient } from "@/generated/prisma/client";

/** Journal export reads the history in cursor batches so a huge history never loads all at once. */
const EXPORT_BATCH = 500;

/** Owns transactional activity appends, paginated reads, and streaming export. */
@singleton()
export class PilotJournalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  async appendJournal(userId: string, body: CreatePilotJournalInput) {
    const rows = await this.prisma.$transaction((tx) => writeActivity(tx, userId, body));
    const items = publishActivity(userId, rows);
    // System entries are how the terminal host surfaces orchestrator restarts ("pilot stopped
    // unexpectedly") - push them so the alert reaches the phone. Fire-and-forget off the hot path.
    for (const entry of items) {
      if (entry.kind === "system") {
        void this.push.sendToUser(userId, {
          title: "Pilot alert",
          body: entry.summary,
          url: "/pilot",
          tag: "pilot-system",
        });
      }
    }
    return { items };
  }

  async listJournal(
    userId: string,
    cursor: string | undefined,
    limit: number,
    kinds?: PilotJournalKind[],
  ) {
    const rows = await this.prisma.pilotJournalEntry.findMany({
      where: { userId, kind: kinds?.length ? { in: kinds } : undefined },
      // id tiebreaks createdAt (batch appends share one timestamp) so cursor pages never skip rows.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // The extra row is what proves more exist; `cursorPage` trims it back off.
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const { items, nextCursor } = cursorPage(rows, limit);
    return { items: items.map(toActivityEntry), nextCursor };
  }

  /**
   * Streams the profile's entire journal as NDJSON (one entry per line, createdAt ascending),
   * pulling in cursor batches so the whole history is never materialized in memory at once.
   */
  streamJournalExport(userId: string): Response {
    const prisma = this.prisma;
    const encoder = new TextEncoder();
    // id tiebreaks createdAt (batch appends share one timestamp) for a deterministic cursor walk.
    let cursor: string | undefined;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (closed) return;
        const rows = await prisma.pilotJournalEntry.findMany({
          where: { userId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: EXPORT_BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (rows.length === 0) {
          closed = true;
          controller.close();
          return;
        }
        for (const row of rows) {
          controller.enqueue(encoder.encode(`${JSON.stringify(toActivityEntry(row))}\n`));
        }
        cursor = rows[rows.length - 1]?.id;
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
