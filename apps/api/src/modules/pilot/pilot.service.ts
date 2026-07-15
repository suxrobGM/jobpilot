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

@singleton()
export class PilotService {
  constructor(private readonly prisma: PrismaClient) {}

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
    const row = await this.prisma.escalation.create({
      data: {
        profileId,
        kind: body.kind,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        question: body.question,
        options: JSON.stringify(body.options),
        deepLink: body.deepLink ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    const escalation = toEscalation(row);
    publish(pilotChannel, { profileId }, { type: "escalation.created", escalation });
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
}
