import type { CreatePilotJournalInput } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import {
  type PilotJournalEntry as PilotJournalEntryModel,
  PrismaClient,
} from "@/generated/prisma/client";
import { toJournalEntry } from "./pilot.mapper";

/** Journal export reads the history in cursor batches so a huge history never loads all at once. */
const EXPORT_BATCH = 500;

/**
 * The pilot's activity log: append (the agent's per-cycle narration), paginated reads, and the
 * NDJSON export. Split from PilotService because every non-controller caller - the agenda compile,
 * networking, promotions, the digest - only ever appends.
 */
@singleton()
export class PilotJournalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  async appendJournal(userId: string, body: CreatePilotJournalInput) {
    const cycleEntries = body.entries.filter((e) => e.kind === "cycle").length;
    const now = new Date();

    // id/createdAt generated app-side so the rows are fully known in-hand for the SSE publishes below.
    const rows: PilotJournalEntryModel[] = body.entries.map((entry) => ({
      id: crypto.randomUUID(),
      userId,
      cycleId: body.cycleId ?? null,
      kind: entry.kind,
      summary: entry.summary,
      detail: JSON.stringify(entry.detail ?? {}),
      subjectType: entry.subjectType ?? null,
      subjectId: entry.subjectId ?? null,
      createdAt: now,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.pilotJournalEntry.createMany({ data: rows });

      // A "cycle" entry marks a completed loop iteration; advance cycle accounting once per such entry.
      if (cycleEntries > 0) {
        await tx.pilotState.upsert({
          where: { userId },
          create: { userId, lastCycleAt: now, cycleCount: cycleEntries },
          update: { lastCycleAt: now, cycleCount: { increment: cycleEntries } },
        });
      }
    });

    const items = rows.map(toJournalEntry);
    for (const entry of items) {
      publish(pilotChannel, { userId }, { type: "journal.appended", entry });
    }
    // System entries are how the terminal host surfaces watchdog kills/restarts ("pilot stopped
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

  async listJournal(userId: string, cursor: string | undefined, limit: number) {
    const rows = await this.prisma.pilotJournalEntry.findMany({
      where: { userId },
      // id tiebreaks createdAt (batch appends share one timestamp) so cursor pages never skip rows.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toJournalEntry),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
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
          controller.enqueue(encoder.encode(`${JSON.stringify(toJournalEntry(row))}\n`));
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
