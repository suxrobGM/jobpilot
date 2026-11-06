import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { authGuard } from "@/common/middleware";
import { sseStream } from "@/common/sse";

export const workspaceController = new Elysia({
  prefix: "/workspace",
  detail: { tags: ["Workspace"] },
})
  .use(authGuard)
  .get(
    "/events",
    ({ user, headers }) => sseStream(workspaceChannel, { userId: user.id }, headers),
    {
      detail: {
        summary: "Stream workspace events",
        description:
          "Opens a Server-Sent Events stream that pushes live cross-feed workspace updates for the user, returning a raw streaming Response that stays open until the client disconnects.",
      },
    },
  );
