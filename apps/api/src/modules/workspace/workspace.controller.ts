import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { profileGuard } from "@/common/middleware";
import { sseStream } from "@/common/sse";

export const workspaceController = new Elysia({
  prefix: "/workspace",
  detail: { tags: ["Workspace"] },
})
  .use(profileGuard)
  .get("/events", ({ profileId, headers }) => sseStream(workspaceChannel, { profileId }, headers), {
    detail: {
      summary: "Stream workspace events",
      description:
        "Opens a Server-Sent Events stream that pushes live cross-campaign workspace updates for the active profile, returning a raw streaming Response that stays open until the client disconnects.",
    },
  });
