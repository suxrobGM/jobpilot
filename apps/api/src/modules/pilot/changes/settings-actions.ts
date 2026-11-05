import { type PilotChangeAction, pilotInstructionsConfigSchema } from "@jobpilot/contracts/pilot";
import { notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import type { ActionContext, ActionOf } from "./action-context";

async function readInstructions(ctx: ActionContext) {
  const row = await ctx.tx.pilotState.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId },
    update: {},
    select: { instructionsGoals: true, instructionsConfig: true },
  });
  return {
    goals: row.instructionsGoals,
    config: pilotInstructionsConfigSchema.parse(row.instructionsConfig),
  };
}

export async function setGoals(
  ctx: ActionContext,
  action: ActionOf<"goals.set">,
): Promise<PilotChangeAction> {
  const { goals } = await readInstructions(ctx);
  await ctx.tx.pilotState.update({
    where: { userId: ctx.userId },
    data: { instructionsGoals: action.goals, instructionsUpdatedAt: ctx.now },
  });
  // Searches picked for the old goals all come due now.
  if (goals !== action.goals) {
    await ctx.tx.pilotSearch.updateMany({
      where: { userId: ctx.userId },
      data: { emptyRuns: 0, nextRunAt: ctx.now },
    });
  }
  return { type: "goals.set", goals };
}

export async function setRules(
  ctx: ActionContext,
  action: ActionOf<"rules.set">,
): Promise<PilotChangeAction> {
  const { config } = await readInstructions(ctx);
  const { type: _, ...rules } = action;
  await ctx.tx.pilotState.update({
    where: { userId: ctx.userId },
    data: {
      instructionsConfig: toInputJson({ ...config, ...rules }),
      instructionsUpdatedAt: ctx.now,
    },
  });
  return {
    type: "rules.set",
    ...(rules.dailyApplyCap !== undefined && { dailyApplyCap: config.dailyApplyCap }),
    ...(rules.minScore !== undefined && { minScore: config.minScore }),
    ...(rules.dealBreakers !== undefined && { dealBreakers: config.dealBreakers }),
  };
}

function findAnswer(ctx: ActionContext, key: string) {
  return ctx.tx.profileAnswer.findUnique({
    where: { userId_key: { userId: ctx.userId, key } },
    select: { value: true },
  });
}

export async function setAnswer(
  ctx: ActionContext,
  action: ActionOf<"answer.set">,
): Promise<PilotChangeAction> {
  const { userId } = ctx;
  const { key, value } = action;
  const old = await findAnswer(ctx, key);
  await ctx.tx.profileAnswer.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value },
    update: { value },
  });
  return old ? { type: "answer.set", key, value: old.value } : { type: "answer.delete", key };
}

export async function deleteAnswer(
  ctx: ActionContext,
  action: ActionOf<"answer.delete">,
): Promise<PilotChangeAction> {
  const old = await findAnswer(ctx, action.key);
  if (!old) throw notFound("Answer not found");
  await ctx.tx.profileAnswer.delete({
    where: { userId_key: { userId: ctx.userId, key: action.key } },
  });
  return { type: "answer.set", key: action.key, value: old.value };
}
