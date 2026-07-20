import { type CampaignConfig, campaignConfigSchema } from "@jobpilot/contracts/campaign";

/** Parses stored campaign JSON into the validated configuration contract. */
export function parseCampaignConfig(value: unknown): CampaignConfig {
  return campaignConfigSchema.parse(value);
}

/** Resolves a campaign score threshold against the supplied default. */
export function resolveMinScore(value: unknown, fallback: number): number {
  return parseCampaignConfig(value).minScore ?? fallback;
}
