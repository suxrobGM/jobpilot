import { feedSchema } from "@jobpilot/contracts/feed";
import {
  addFeedNetworkingSchema,
  networkingMessageResultSchema,
  patchNetworkingMessageSchema,
} from "@jobpilot/contracts/networking";
import { paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { UserService } from "@/modules/user/user.service";
import {
  networkingMessageListSchema,
  networkingMessageParams,
  networkingMessageQuerySchema,
  networkingMessageResultResponseSchema,
  networkingMessageSchema,
} from "./networking.schema";
import { NetworkingService } from "./networking.service";
import { StandingNetworkingService } from "./standing-feed.service";

const svc = container.get(NetworkingService);
const standing = container.get(StandingNetworkingService);
const users = container.get(UserService);

export const networkingController = new Elysia({ detail: { tags: ["Feeds"] } })
  .use(authGuard)
  .post("/networking/feed", ({ user }) => standing.getOrCreate(user.id), {
    response: feedSchema,
    detail: {
      summary: "Get the standing networking feed",
      description:
        "Returns the user's one open networking feed for outreach that belongs to no job, creating it on first use with the primary resume.",
    },
  })
  .get(
    "/networking/messages",
    ({ user, query }) => svc.listNetworking(user.id, { ...query, order: "desc" }),
    {
      query: networkingMessageQuerySchema,
      response: networkingMessageListSchema,
      detail: {
        summary: "List networking messages across feeds",
        description:
          "Returns one page of the user's networking messages, newest first. Optional `status` and `feedId` filters.",
      },
    },
  )
  .get(
    "/feeds/:id/networking/messages",
    ({ user, params, query }) => svc.listNetworking(user.id, { ...query, feedId: params.id }),
    {
      params: idParam,
      query: paginationQuerySchema,
      response: networkingMessageListSchema,
      detail: {
        summary: "List networking messages",
        description:
          "Returns one page of the feed's networking messages with contacts, ordered by creation.",
      },
    },
  )
  .post(
    "/feeds/:id/networking/messages",
    async ({ user, params, body }) => {
      await users.requireVerifiedEmail(user.id);
      return svc.addNetworking(user.id, params.id, body);
    },
    {
      params: idParam,
      body: addFeedNetworkingSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Add networking message",
        description:
          "Atomically adds a contact (new or existing) and an initial non-terminal networking message. Requires a verified email address.",
      },
    },
  )
  .patch(
    "/feeds/:id/networking/messages/:messageId",
    ({ user, params, body }) => svc.patchNetworking(user.id, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: patchNetworkingMessageSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Update networking message",
        description:
          "Applies a conditional non-terminal message edit or contact connection update. Terminal outcomes go through the result route.",
      },
    },
  )
  .post(
    "/feeds/:id/networking/messages/:messageId/result",
    ({ user, params, body }) =>
      svc.recordNetworkingResult(user.id, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: networkingMessageResultSchema,
      response: networkingMessageResultResponseSchema,
      detail: {
        summary: "Record networking message result",
        description:
          "Idempotently records a terminal outcome, stamps delivery identifiers when sent, and returns the message.",
      },
    },
  );
