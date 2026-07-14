import { API_BASE_URL } from "@/api/base-url";
import { defineChannel } from "../channel";

export type CampaignEvent =
  | { type: "log"; payload: Record<string, unknown> }
  | { type: "progress"; payload: Record<string, unknown> }
  | { type: "status"; payload: { status: string } }
  | { type: "job-update"; payload: { kind: "added" | "updated"; job: unknown } }
  | { type: "outreach-update"; payload?: Record<string, unknown> };

/** Live event feed scoped to a single campaign (logs, progress, job updates). */
export const campaignChannel = defineChannel<CampaignEvent, { campaignId: string }>({
  name: "campaign",
  url: ({ campaignId }) => `${API_BASE_URL}/api/campaigns/${encodeURIComponent(campaignId)}/events`,
});
