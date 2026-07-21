import type { CampaignActor } from "@jobpilot/contracts/campaign";

/** Actor names as shown in status attributions ("Paused by you / the agent / the pilot"). */
export const CAMPAIGN_ACTOR_LABEL: Record<CampaignActor, string> = {
  user: "you",
  agent: "the agent",
  pilot: "the pilot",
};
