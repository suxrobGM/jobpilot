import type {
  AnswerEscalationInput,
  CreateEscalationInput,
  CreatePilotJournalInput,
  EscalationStatus,
  SetPilotEnabledInput,
  UpdatePilotMandateInput,
} from "@jobpilot/contracts/pilot";
import { pilotMandateConfigSchema } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type PilotJournalEntry as PilotJournalEntryModel,
  type PilotState as PilotStateModel,
  PrismaClient,
} from "@/generated/prisma/client";
import { toEscalation, toJournalEntry, toPilotState } from "./pilot.mapper";
import { countAppliedToday } from "./pilot.stats";
import { PushService } from "./push.service";

/** 2FA codes die within minutes, so an unanswered 2FA escalation must self-expire fast; the agenda
 *  expiry sweep then cleanly skips the parked job instead of leaving it wedged in needs_user. */
const TWO_FA_TTL_MS = 5 * 60 * 1000;

/** Journal export reads the history in cursor batches so a huge history never loads all at once. */
const EXPORT_BATCH = 500;

function escalationExpiry(body: CreateEscalationInput): Date | null {
  if (body.expiresAt) return new Date(body.expiresAt);
  if (body.kind === "2fa") return new Date(Date.now() + TWO_FA_TTL_MS);
  return null;
}

@singleton()
export class PilotService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  // ── State / mandate ───────────────────────────────────────────────────────────

  /**
   * Full state DTO shared by every state-returning route: the persisted row plus
   * today's tz-aware applied count. The tz lives in the row's config, so the count
   * runs after the upsert rather than in parallel with it.
   */
  private async toStateDto(profileId: string, row: PilotStateModel) {
    const config = pilotMandateConfigSchema.parse(JSON.parse(row.mandateConfig));
    const appliedToday = await countAppliedToday(
      this.prisma,
      profileId,
      new Date(),
      config.activeHours?.tz,
    );
    return toPilotState(row, appliedToday);
  }

  /** Create-on-first-read: every profile has exactly one PilotState, defaulted. */
  async getState(profileId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
    return this.toStateDto(profileId, row);
  }

  async updateMandate(profileId: string, body: UpdatePilotMandateInput) {
    const row = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: {
        profileId,
        mandateGoals: body.goals,
        mandateConfig: JSON.stringify(body.config),
        mandateUpdatedAt: new Date(),
      },
      update: {
        mandateGoals: body.goals,
        mandateConfig: JSON.stringify(body.config),
        mandateUpdatedAt: new Date(),
      },
    });
    const state = await this.toStateDto(profileId, row);
    publish(pilotChannel, { profileId }, { type: "state.changed", state });
    return state;
  }

  async setEnabled(profileId: string, body: SetPilotEnabledInput) {
    const row = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
    const state = await this.toStateDto(profileId, row);
    publish(pilotChannel, { profileId }, { type: "state.changed", state });
    return state;
  }

  // ── Escalations ───────────────────────────────────────────────────────────────

  async createEscalation(profileId: string, body: CreateEscalationInput) {
    const expiresAt = escalationExpiry(body);
    const row = await this.prisma.escalation.create({
      data: {
        profileId,
        kind: body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        question: body.question,
        options: JSON.stringify(body.options),
        deepLink: body.deepLink ?? null,
        expiresAt,
      },
    });
    const escalation = toEscalation(row);
    publish(pilotChannel, { profileId }, { type: "escalation.created", escalation });
    // Fire-and-forget so a slow/failed push never delays the escalation write.
    void this.push.sendToProfile(profileId, {
      title: "JobPilot needs you",
      body: row.question,
      url: row.deepLink ?? "/pilot",
      tag: `escalation-${row.id}`,
    });
    return escalation;
  }

  async listEscalations(profileId: string, status?: EscalationStatus) {
    const rows = await this.prisma.escalation.findMany({
      where: { profileId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toEscalation);
  }

  async answerEscalation(profileId: string, id: string, body: AnswerEscalationInput) {
    await findOwned(
      (where) => this.prisma.escalation.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Escalation",
    );

    const row = await this.prisma.escalation.update({
      where: { id },
      data: { status: "answered", answer: body.answer, answeredAt: new Date() },
    });
    const escalation = toEscalation(row);
    publish(pilotChannel, { profileId }, { type: "escalation.answered", escalation });
    return escalation;
  }

  // ── Journal ───────────────────────────────────────────────────────────────────

  async appendJournal(profileId: string, body: CreatePilotJournalInput) {
    const cycleEntries = body.entries.filter((e) => e.kind === "cycle").length;
    const now = new Date();

    // id/createdAt generated app-side so the rows are fully known in-hand for the SSE publishes below.
    const rows: PilotJournalEntryModel[] = body.entries.map((entry) => ({
      id: crypto.randomUUID(),
      profileId,
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
          where: { profileId },
          create: { profileId, lastCycleAt: now, cycleCount: cycleEntries },
          update: { lastCycleAt: now, cycleCount: { increment: cycleEntries } },
        });
      }
    });

    const items = rows.map(toJournalEntry);
    for (const entry of items) {
      publish(pilotChannel, { profileId }, { type: "journal.appended", entry });
    }
    // System entries are how the terminal host surfaces watchdog kills/restarts ("pilot stopped
    // unexpectedly") - push them so the alert reaches the phone. Fire-and-forget off the hot path.
    for (const entry of items) {
      if (entry.kind === "system") {
        void this.push.sendToProfile(profileId, {
          title: "Pilot alert",
          body: entry.summary,
          url: "/pilot",
          tag: "pilot-system",
        });
      }
    }
    return { items };
  }

  async listJournal(profileId: string, cursor: string | undefined, limit: number) {
    const rows = await this.prisma.pilotJournalEntry.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
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
  streamJournalExport(profileId: string): Response {
    const prisma = this.prisma;
    const encoder = new TextEncoder();
    // id tiebreaks createdAt (batch appends share one timestamp) for a deterministic cursor walk.
    let cursor: string | undefined;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (closed) return;
        const rows = await prisma.pilotJournalEntry.findMany({
          where: { profileId },
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
