import {
  type Escalation,
  type EscalationKind,
  type EscalationStatus,
  type PilotJournalEntry,
  type PilotJournalKind,
  type PilotLease,
  type PilotState,
  pilotMandateConfigSchema,
} from "@jobpilot/contracts/pilot";
import type {
  Escalation as EscalationModel,
  PilotJournalEntry as PilotJournalEntryModel,
  PilotLease as PilotLeaseModel,
  PilotState as PilotStateModel,
} from "@/generated/prisma/client";

export function toPilotState(row: PilotStateModel): PilotState {
  return {
    profileId: row.profileId,
    enabled: row.enabled,
    mandateGoals: row.mandateGoals,
    mandateConfig: pilotMandateConfigSchema.parse(JSON.parse(row.mandateConfig)),
    mandateUpdatedAt: row.mandateUpdatedAt,
    lastCycleAt: row.lastCycleAt,
    cycleCount: row.cycleCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toEscalation(row: EscalationModel): Escalation {
  return {
    id: row.id,
    profileId: row.profileId,
    kind: row.kind as EscalationKind,
    status: row.status as EscalationStatus,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    question: row.question,
    options: JSON.parse(row.options) as string[],
    deepLink: row.deepLink,
    answer: row.answer,
    answeredAt: row.answeredAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export function toJournalEntry(row: PilotJournalEntryModel): PilotJournalEntry {
  return {
    id: row.id,
    profileId: row.profileId,
    cycleId: row.cycleId,
    kind: row.kind as PilotJournalKind,
    summary: row.summary,
    detail: JSON.parse(row.detail) as Record<string, unknown>,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    createdAt: row.createdAt,
  };
}

export function toPilotLease(row: PilotLeaseModel): PilotLease {
  return {
    id: row.id,
    profileId: row.profileId,
    kind: row.kind,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    grantedAt: row.grantedAt,
    heartbeatAt: row.heartbeatAt,
    expiresAt: row.expiresAt,
    releasedAt: row.releasedAt,
    outcome: row.outcome,
  };
}
