import {
  addCampaignNetworkingSchema,
  networkingMessageResultSchema,
  patchNetworkingMessageSchema,
} from "@jobpilot/contracts/networking";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard, requireVerifiedEmail } from "@/common/middleware";
import { campaignParams, networkingMessageParams } from "../campaign.schema";
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
  .use(profileGuard)
  .get("/:id/networking", ({ profileId, params }) => svc.listNetworking(profileId, params.id), {
    params: campaignParams,
    response: networkingMessageListSchema,
    detail: {
      summary: "List networking messages",
      description:
        "Returns the campaign's networking messages with their contacts, ordered by creation.",
    },
  })
  .post(
    "/:id/networking",
    async ({ user, profileId, params, body }) => {
      await requireVerifiedEmail(user.id);
      return svc.addNetworking(profileId, params.id, body);
    },
    {
      params: campaignParams,
      body: addCampaignNetworkingSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Add networking message",
        description:
          "Adds a contact (new or existing) and an initial draft networking message to the campaign, recomputes the networking summary, emits an SSE update, and returns the created message. Requires a verified email address.",
      },
    },
  )
  .patch(
    "/:id/networking/:messageId",
    ({ profileId, params, body }) =>
      svc.patchNetworking(profileId, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: patchNetworkingMessageSchema,
      response: networkingMessageSchema,
      detail: {
        summary: "Update networking message",
        description:
          "Applies a non-terminal edit to a networking message (draft body/subject, draft-to-approved, or the contact's LinkedIn connection state), recomputes the summary on status changes, and returns the updated message.",
      },
    },
  )
  .post(
    "/:id/networking/:messageId/result",
    ({ profileId, params, body }) =>
      svc.recordNetworkingResult(profileId, params.id, params.messageId, body),
    {
      params: networkingMessageParams,
      body: networkingMessageResultSchema,
      response: networkingMessageResultResponseSchema,
      detail: {
        summary: "Record networking message result",
        description:
          "Records a networking message's terminal outcome (sent/failed/skipped), stamps the send time and Gmail provider/thread ids, recomputes the summary, and returns the message and summary.",
      },
    },
  );
