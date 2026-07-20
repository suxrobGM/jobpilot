import {
  type PilotInstructionsConfig,
  type PilotLease,
  type PilotState,
  type Promotion,
  pilotLeaseSchema,
  type Question,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { reviveJsonDates } from "@/common/json";
import type {
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
    userId: row.userId,
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
    ...row,
    kind: row.kind === "two_factor" ? "2fa" : row.kind,
    options: z.array(z.string()).parse(row.options),
  };
}

export function toPromotion(row: PromotionPostModel): Promotion {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    target: row.target,
    title: row.title,
    body: row.body,
    status: row.status,
    postedUrl: row.postedUrl,
    scheduledFor: row.scheduledFor,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPilotLease(row: PilotLeaseModel): PilotLease {
  return pilotLeaseSchema.parse({ ...row, payload: reviveJsonDates(row.payload) });
}
