import { API_BASE_URL } from "@/api/base-url";
import { defineChannel } from "../channel";

export type InboxEvent =
  | { type: "sync.started" }
  | { type: "sync.progress"; fetched: number; new: number }
  | { type: "message.scanned"; id: string }
  | { type: "message.reviewed"; id: string; status: "approved" | "denied" };

/** Per-profile inbox feed: sync progress + per-message scan/review state. Mirrors the API channel;
 *  the URL is param-free because the server resolves the profile from the session. */
export const inboxChannel = defineChannel<InboxEvent, void>({
  name: "inbox",
  url: () => `${API_BASE_URL}/api/email/events`,
});
