import {
  type CampaignConfig,
  type CampaignJobSummary,
  type CampaignSummary,
  type CampaignSource as WireCampaignSource,
} from "@jobpilot/contracts/campaign";
import type { ContactDiscoverySource as WireContactDiscoverySource } from "@jobpilot/contracts/networking";
import type {
  Campaign,
  CampaignSource,
  ContactDiscoverySource,
  Prisma,
} from "@/generated/prisma/client";
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

const DISCOVERY_SOURCE_TO_WIRE: Record<ContactDiscoverySource, WireContactDiscoverySource> = {
  google: "google",
  company_site: "company-site",
  web: "web",
  linkedin: "linkedin",
  manual: "manual",
};

function toWireDiscoverySource(
  source: ContactDiscoverySource | null,
): WireContactDiscoverySource | null {
  return source ? DISCOVERY_SOURCE_TO_WIRE[source] : null;
}

export function toNetworkingMessageRow(
  message: Prisma.NetworkingMessageGetPayload<{ include: { contact: true } }>,
) {
  return {
    ...message,
    contact: {
      ...message.contact,
      discoverySource: toWireDiscoverySource(message.contact.discoverySource),
    },
  };
}

export function isJobSummary(summary: CampaignSummary): summary is CampaignJobSummary {
  return summary.kind === "jobs";
}
