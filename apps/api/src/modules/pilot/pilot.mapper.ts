import {
  type PilotClaim,
  type PilotInstructionsConfig,
  type PilotQuestion,
  type PilotState,
  type Promotion,
  pilotClaimSchema,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { reviveJsonDates } from "@/common/json";
import type {
  PilotClaim as PilotClaimModel,
  PilotQuestion as PilotQuestionModel,
  PilotState as PilotStateModel,
  PromotionPost as PromotionPostModel,
} from "@/generated/prisma/client";

export function toPilotState(
  row: PilotStateModel,
  appliedToday: number,
  instructionsConfig: PilotInstructionsConfig,
): PilotState {
  return {
    userId: row.userId,
    running: row.running,
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

export function toPilotQuestion(row: PilotQuestionModel): PilotQuestion {
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

export function toPilotClaim(row: PilotClaimModel): PilotClaim {
  return pilotClaimSchema.parse({ ...row, payload: reviveJsonDates(row.payload) });
}
