import { type PilotMandateConfig, pilotMandateConfigSchema } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Read the profile's Pilot mandate config, defaulting to a full config when no state
 * row exists yet. Kept dependency-free (contracts + Prisma only) so the campaign
 * outreach send path can read the cap without importing the pilot services (circular dep).
 */
export async function loadMandateConfig(
  prisma: Pick<PrismaClient, "pilotState">,
  profileId: string,
): Promise<PilotMandateConfig> {
  const state = await prisma.pilotState.findUnique({
    where: { profileId },
    select: { mandateConfig: true },
  });
  return pilotMandateConfigSchema.parse(JSON.parse(state?.mandateConfig ?? "{}"));
}
