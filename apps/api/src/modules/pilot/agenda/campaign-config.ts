import { type CampaignConfig, campaignConfigSchema } from "@jobpilot/contracts/campaign";

/** Schema-parse a campaign's stored config JSON; null when absent or malformed, so one bad row can't poison the compile. */
export function parseCampaignConfig(raw: string | null | undefined): CampaignConfig | null {
  if (!raw) return null;
  try {
    return campaignConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
