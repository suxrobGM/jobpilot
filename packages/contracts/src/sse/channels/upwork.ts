import { defineChannel } from "../channel";

export type UpworkEvent =
  | { type: "proposal.created"; id: string }
  | { type: "proposal.updated"; id: string }
  | { type: "proposal.deleted"; id: string }
  | { type: "profile.updated" };

/**
 * Profile-scoped feed for the Upwork proposals page. The path is parameter-free;
 * the server resolves the profile from the session.
 */
export const upworkChannel = defineChannel<UpworkEvent, void, { profileId: string }>({
  name: "upwork",
  path: () => "/api/upwork/events",
  topic: ({ profileId }) => String(profileId),
});
