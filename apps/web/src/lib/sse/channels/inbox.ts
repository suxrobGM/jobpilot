import { API_BASE_URL } from "@/api/base-url";
import { defineChannel } from "../channel";

export type InboxEvent =
  | { type: "sync.started" }
  | { type: "sync.progress"; fetched: number; new: number }
  | { type: "message.scanned"; id: string }
  | { type: "message.reviewed"; id: string; status: "approved" | "denied" };

/** Single global inbox feed: sync progress + per-message scan/review state. */
export const inboxChannel = defineChannel<InboxEvent>({
  name: "inbox",
  url: () => `${API_BASE_URL}/api/email/events`,
  topic: () => "inbox",
});
