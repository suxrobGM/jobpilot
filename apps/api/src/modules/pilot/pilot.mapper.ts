import type {
  Escalation,
  EscalationKind,
  EscalationStatus,
  PilotJournalEntry,
  PilotJournalKind,
  PilotLease,
  PilotMandateConfig,
  PilotState,
  Promotion,
  PromotionStatus,
} from "@jobpilot/contracts/pilot";
import type {
  Escalation as EscalationModel,
  PilotJournalEntry as PilotJournalEntryModel,
  PilotLease as PilotLeaseModel,
  PilotState as PilotStateModel,
  PromotionPost as PromotionPostModel,
} from "@/generated/prisma/client";

export function toPilotState(
  row: PilotStateModel,
  appliedToday: number,
  mandateConfig: PilotMandateConfig,
): PilotState {
  return {
    profileId: row.profileId,
    enabled: row.enabled,
    mandateGoals: row.mandateGoals,
    mandateConfig,
    mandateUpdatedAt: row.mandateUpdatedAt,
    lastCycleAt: row.lastCycleAt,
    cycleCount: row.cycleCount,
    appliedToday,
    capReached: mandateConfig.dailyApplyCap > 0 && appliedToday >= mandateConfig.dailyApplyCap,
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

export function toPromotion(row: PromotionPostModel): Promotion {
  return {
    id: row.id,
    profileId: row.profileId,
    venue: row.venue,
    target: row.target,
    title: row.title,
    body: row.body,
    status: row.status as PromotionStatus,
    postedUrl: row.postedUrl,
    scheduledFor: row.scheduledFor,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
