import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";

export function parseInstructionsConfig(value: unknown): PilotInstructionsConfig {
  return pilotInstructionsConfigSchema.parse(value);
}

export async function loadInstructions(
  prisma: Pick<PrismaClient, "pilotState">,
  userId: string,
): Promise<{ config: PilotInstructionsConfig; goals: string }> {
  const state = await prisma.pilotState.findUnique({
    where: { userId },
    select: { instructionsConfig: true, instructionsGoals: true },
  });
  return {
    config: parseInstructionsConfig(state?.instructionsConfig ?? {}),
    goals: state?.instructionsGoals ?? "",
  };
}
