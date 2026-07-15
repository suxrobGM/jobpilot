import type {
  AnswerEscalationInput,
  CreateEscalationInput,
  CreatePilotJournalInput,
  EscalationStatus,
  SetPilotEnabledInput,
  UpdatePilotMandateInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { toEscalation, toJournalEntry, toPilotState } from "./pilot.mapper";

@singleton()
export class PilotService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── State / mandate ───────────────────────────────────────────────────────────

  /** Create-on-first-read: every profile has exactly one PilotState, defaulted. */
  async getState(profileId: string) {
    const row = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId },
      update: {},
    });
    return toPilotState(row);
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
    const state = toPilotState(row);
    publish(pilotChannel, { profileId }, { type: "state.changed", state });
    return state;
  }

  async setEnabled(profileId: string, body: SetPilotEnabledInput) {
    const row = await this.prisma.pilotState.upsert({
      where: { profileId },
      create: { profileId, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
    const state = toPilotState(row);
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

    const rows = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const entry of body.entries) {
        created.push(
          await tx.pilotJournalEntry.create({
            data: {
              profileId,
              cycleId: body.cycleId ?? null,
              kind: entry.kind,
              summary: entry.summary,
              detail: JSON.stringify(entry.detail ?? {}),
              subjectType: entry.subjectType ?? null,
              subjectId: entry.subjectId ?? null,
            },
          }),
        );
      }

      // A "cycle" entry marks a completed loop iteration; advance cycle accounting once per such entry.
      if (cycleEntries > 0) {
        await tx.pilotState.upsert({
          where: { profileId },
          create: { profileId, lastCycleAt: new Date(), cycleCount: cycleEntries },
          update: { lastCycleAt: new Date(), cycleCount: { increment: cycleEntries } },
        });
      }

      return created;
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
