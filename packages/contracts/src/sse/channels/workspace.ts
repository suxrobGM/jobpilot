import { defineChannel } from "../channel";

export type WorkspaceEvent =
  | { type: "campaign.updated"; campaignId: string; status?: string; source?: string }
  | { type: "campaign.completed"; campaignId: string }
  | { type: "campaign.deleted"; campaignId: string }
  | { type: "campaignjob.created"; campaignId: string; key: string }
  | { type: "campaignjob.updated"; campaignId: string; key: string; status?: string }
  | { type: "application.created"; campaignId: string | null };

/**
 * Profile-scoped live-refresh feed for the workspace UI (dashboard, auto-apply pill).
 * The path is parameter-free; the server resolves the profile from the session.
 */
export const workspaceChannel = defineChannel<WorkspaceEvent, void, { userId: string }>({
  name: "workspace",
  path: () => "/api/workspace/events",
  topic: ({ userId }) => String(userId),
});
