import { defineChannel } from "../channel";

export type PipelineEvent =
  | { type: "campaign.updated"; campaignId: string; status?: string; source?: string }
  | { type: "campaign.completed"; campaignId: string }
  | { type: "campaign.deleted"; campaignId: string }
  | { type: "campaignjob.created"; campaignId: string; key: string }
  | { type: "campaignjob.updated"; campaignId: string; key: string; status?: string }
  | { type: "application.created"; campaignId: string | null }
  | { type: "queue.updated" };

/**
 * Profile-scoped feed for cross-campaign UI (kanban, auto-apply pill). The client
 * URL is parameter-free; the server resolves the profile from the session.
 */
export const pipelineChannel = defineChannel<PipelineEvent, void, { profileId: number }>({
  name: "pipeline",
  url: () => "/api/pipeline/events",
  topic: ({ profileId }) => String(profileId),
});
