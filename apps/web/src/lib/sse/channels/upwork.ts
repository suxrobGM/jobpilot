import { API_BASE_URL } from "@/api/base-url";
import { defineChannel } from "../channel";

export type UpworkEvent =
  | { type: "proposal.created"; id: string }
  | { type: "proposal.updated"; id: string }
  | { type: "proposal.deleted"; id: string }
  | { type: "profile.updated" };

/**
 * Profile-scoped feed for the Upwork proposals page. The client URL is
 * parameter-free; the server resolves the profile from the session.
 */
export const upworkChannel = defineChannel<UpworkEvent, void>({
  name: "upwork",
  url: () => `${API_BASE_URL}/api/upwork/events`,
});
