import {
  addCampaignNetworkingSchema,
  networkingMessageResultSchema,
  patchNetworkingMessageSchema,
} from "@jobpilot/contracts/networking";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard, requireVerifiedEmail } from "@/common/middleware";
import { campaignParams, networkingMessageParams, paginationQuery } from "../campaign.schema";
import {
  networkingMessageListSchema,
  networkingMessageResultResponseSchema,
  networkingMessageSchema,
} from "./networking.schema";
import { CampaignNetworkingService } from "./networking.service";

const svc = container.resolve(CampaignNetworkingService);

export const campaignNetworkingController = new Elysia({
  name: "campaign-networking",
  detail: { tags: ["Campaigns"] },
})
  .use(authGuard)
  .get(
    "/:id/networking",
    ({ user, params, query }) => svc.listNetworking(user.id, params.id, query),
    {
      params: campaignParams,
      query: paginationQuery,
      response: networkingMessageListSchema,
      detail: {
        summary: "List networking messages",
        description:
          "Returns one page of the campaign's networking messages with contacts, ordered by creation.",
      },
    },
  )
  .post(
    "/:id/networking",
    async ({ user, params, body }) => {
      await requireVerifiedEmail(user.id);
      return svc.addNetworking(user.id, params.id, body);
    },
    {
      params: campaignParams,
      body: addCampaignNetworkingSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Add networking message",
        description:
          "Atomically adds a contact (new or existing) and an initial non-terminal networking message, emits an SSE update, and returns it. Requires a verified email address.",
      },
    },
  )
  .patch(
    "/:id/networking/:messageId",
    ({ user, params, body }) => svc.patchNetworking(user.id, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: patchNetworkingMessageSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Update networking message",
        description:
          "Applies a conditional non-terminal message edit or contact connection update and returns the updated message. Terminal outcomes are accepted only by the result route.",
      },
    },
  )
  .post(
    "/:id/networking/:messageId/result",
    ({ user, params, body }) =>
      svc.recordNetworkingResult(user.id, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: networkingMessageResultSchema,
      response: networkingMessageResultResponseSchema,
      detail: {
        summary: "Record networking message result",
        description:
          "Conditionally records an idempotent terminal outcome, stamps delivery identifiers when sent, and returns the message with its current derived summary.",
      },
    },
  );
