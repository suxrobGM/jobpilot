import { defineChannel } from "../channel";

export type UpworkEvent =
  | { type: "proposal.created"; id: number }
  | { type: "proposal.updated"; id: number }
  | { type: "proposal.deleted"; id: number }
  | { type: "profile.updated" };

/**
 * Profile-scoped feed for the Upwork proposals page. The client URL is
 * parameter-free; the server resolves the profile from the session.
 */
export const upworkChannel = defineChannel<UpworkEvent, void, { profileId: number }>({
  name: "upwork",
  url: () => "/api/upwork/events",
  topic: ({ profileId }) => String(profileId),
});
