import { defineChannel } from "../channel";

export type InboxEvent =
  | { type: "sync.started" }
  | { type: "sync.progress"; fetched: number; new: number }
  | { type: "message.scanned"; id: string }
  | { type: "message.reviewed"; id: string; status: "approved" | "denied" };

/**
 * Per-profile inbox feed: sync progress + per-message scan/review state. The path is param-free -
 * the server resolves the profile from the session. A constant topic would put every tenant on one
 * topic *and* one replay buffer (see the API's server.test.ts).
 */
export const inboxChannel = defineChannel<InboxEvent, void, { profileId: string }>({
  name: "inbox",
  path: () => "/api/email/events",
  topic: ({ profileId }) => String(profileId),
});
