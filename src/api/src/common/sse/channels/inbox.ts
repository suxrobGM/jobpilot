import { defineChannel } from "../channel";

export type InboxEvent =
  | { type: "sync.started" }
  | { type: "sync.progress"; fetched: number; new: number }
  | { type: "message.scanned"; id: number }
  | { type: "message.reviewed"; id: number; status: "approved" | "denied" };

/** Single global inbox feed: sync progress + per-message scan/review state. */
export const inboxChannel = defineChannel<InboxEvent>({
  name: "inbox",
  url: () => "/api/email/events",
  topic: () => "inbox",
});
