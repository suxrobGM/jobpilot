import { defineChannel } from "../channel";

export type WorkspaceEvent =
  | { type: "feed.updated"; feedId: string }
  | { type: "job.created"; feedId: string; key: string }
  | { type: "job.updated"; feedId: string; key: string; status?: string }
  | { type: "application.created"; feedId: string | null }
  // Mirrors the per-resume channel, so the resume list holds one connection, not one per row.
  | { type: "resume.updated"; resumeId: string };

/** Parameter-free: the server resolves the profile from the session. */
export const workspaceChannel = defineChannel<WorkspaceEvent, void, { userId: string }>({
  name: "workspace",
  path: () => "/api/workspace/events",
  topic: ({ userId }) => String(userId),
});
