import {
  type CampaignConfig,
  type CampaignJobSummary,
  type CampaignSummary,
  type CampaignSource as WireCampaignSource,
} from "@jobpilot/contracts/campaign";
import type { Campaign, CampaignSource } from "@/generated/prisma/client";
import { parseCampaignConfig } from "./campaign.config";

export type CampaignRow = Omit<Campaign, "config" | "source"> & {
  source: WireCampaignSource;
  config: CampaignConfig;
  summary: CampaignSummary;
};

export function toPrismaCampaignSource(source: WireCampaignSource): CampaignSource {
  return source === "auto-apply" ? "auto_apply" : source;
}

export function toWireCampaignSource(source: CampaignSource): WireCampaignSource {
  return source === "auto_apply" ? "auto-apply" : source;
}

/** Campaign kinds whose scored `pending` rows the pilot promotes on its own - auto-apply from
 *  discovery, apply from pasted links. Search and networking never promote. */
export const PROMOTABLE_SOURCES: CampaignSource[] = ["auto_apply", "apply"];

export function toCampaignRow(campaign: Campaign, summary: CampaignSummary): CampaignRow {
  return {
    ...campaign,
    source: toWireCampaignSource(campaign.source),
    config: parseCampaignConfig(campaign.config),
    summary,
  };
}

export function isJobSummary(summary: CampaignSummary): summary is CampaignJobSummary {
  return summary.kind === "jobs";
}
