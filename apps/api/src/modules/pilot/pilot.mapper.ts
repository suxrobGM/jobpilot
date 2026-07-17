import type {
  PilotInstructionsConfig,
  PilotJournalEntry,
  PilotJournalKind,
  PilotLease,
  PilotState,
  Promotion,
  PromotionStatus,
  Question,
  QuestionKind,
  QuestionStatus,
} from "@jobpilot/contracts/pilot";
import type {
  PilotJournalEntry as PilotJournalEntryModel,
  PilotLease as PilotLeaseModel,
  PilotState as PilotStateModel,
  PromotionPost as PromotionPostModel,
  Question as QuestionModel,
} from "@/generated/prisma/client";

export function toPilotState(
  row: PilotStateModel,
  appliedToday: number,
  instructionsConfig: PilotInstructionsConfig,
): PilotState {
  return {
    profileId: row.profileId,
    enabled: row.enabled,
    instructionsGoals: row.instructionsGoals,
    instructionsConfig,
    instructionsUpdatedAt: row.instructionsUpdatedAt,
    lastCycleAt: row.lastCycleAt,
    cycleCount: row.cycleCount,
    appliedToday,
    // Cap 0 means "apply to nothing" - build.ts treats it as reached, so the mapper must too.
    capReached: appliedToday >= instructionsConfig.dailyApplyCap,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toQuestion(row: QuestionModel): Question {
  return {
    id: row.id,
    profileId: row.profileId,
    kind: row.kind as QuestionKind,
    status: row.status as QuestionStatus,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    prompt: row.prompt,
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
    platform: row.platform,
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
