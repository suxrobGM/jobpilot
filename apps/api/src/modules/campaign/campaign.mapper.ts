import type {
  CampaignConfig,
  CampaignJobSummary,
  CampaignSummary,
} from "@jobpilot/contracts/campaign";
import type { Campaign, CampaignSource } from "@/generated/prisma/client";
import { parseCampaignConfig } from "./campaign.config";

export type CampaignRow = Omit<Campaign, "config"> & {
  config: CampaignConfig;
  summary: CampaignSummary;
};

/** Campaign kinds whose scored `pending` rows the pilot promotes on its own - auto-apply from
 *  discovery, apply from pasted links. Search and networking never promote. */
export const PROMOTABLE_SOURCES: CampaignSource[] = ["auto_apply", "apply"];

export function toCampaignRow(campaign: Campaign, summary: CampaignSummary): CampaignRow {
  return {
    ...campaign,
    config: parseCampaignConfig(campaign.config),
    summary,
  };
}

export function isJobSummary(summary: CampaignSummary): summary is CampaignJobSummary {
  return summary.kind === "jobs";
}
