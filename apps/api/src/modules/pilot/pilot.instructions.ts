import {
  type PilotInstructionsConfig,
  pilotInstructionsConfigSchema,
} from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Read the profile's Pilot instructions config, defaulting to a full config when no state
 * row exists yet. Kept dependency-free (contracts + Prisma only) so the campaign
 * outreach send path can read the cap without importing the pilot services (circular dep).
 */
export async function loadInstructionsConfig(
  prisma: Pick<PrismaClient, "pilotState">,
  profileId: string,
): Promise<PilotInstructionsConfig> {
  const state = await prisma.pilotState.findUnique({
    where: { profileId },
    select: { instructionsConfig: true },
  });
  return pilotInstructionsConfigSchema.parse(JSON.parse(state?.instructionsConfig ?? "{}"));
}
