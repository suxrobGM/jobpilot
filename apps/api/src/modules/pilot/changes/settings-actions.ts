import { type PilotChangeAction, pilotConfigSchema } from "@jobpilot/contracts/pilot";
import { notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import type { ActionContext, ActionOf } from "./action-context";

export async function setRules(
  ctx: ActionContext,
  action: ActionOf<"rules.set">,
): Promise<PilotChangeAction> {
  const row = await ctx.tx.pilotState.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId },
    update: {},
    select: { config: true },
  });
  const config = pilotConfigSchema.parse(row.config);
  const { type: _, ...rules } = action;
  await ctx.tx.pilotState.update({
    where: { userId: ctx.userId },
    data: { config: toInputJson({ ...config, ...rules }) },
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
  if (!old) {
    throw notFound("Answer not found");
  }
  await ctx.tx.profileAnswer.delete({
    where: { userId_key: { userId: ctx.userId, key: action.key } },
  });
  return { type: "answer.set", key: action.key, value: old.value };
}
