import {
  addCampaignOutreachSchema,
  outreachMessageResultSchema,
  patchOutreachMessageSchema,
} from "@jobpilot/contracts/outreach";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { campaignParams, outreachMessageParams } from "../campaign.schema";
import {
  outreachMessageListSchema,
  outreachMessageResultResponseSchema,
  outreachMessageSchema,
} from "./outreach.schema";
import { CampaignOutreachService } from "./outreach.service";

const svc = container.resolve(CampaignOutreachService);

export const campaignOutreachController = new Elysia({
  name: "campaign-outreach",
  detail: { tags: ["Campaigns"] },
})
  .use(profileGuard)
  .get("/:id/outreach", ({ profileId, params }) => svc.listOutreach(profileId, params.id), {
    params: campaignParams,
    response: outreachMessageListSchema,
    detail: {
      summary: "List outreach messages",
      description:
        "Returns the campaign's outreach messages with their contacts, ordered by creation.",
    },
  })
  .post(
    "/:id/outreach",
    ({ profileId, params, body }) => svc.addOutreach(profileId, params.id, body),
    {
      params: campaignParams,
      body: addCampaignOutreachSchema,
      response: outreachMessageSchema,
      detail: {
        summary: "Add outreach message",
        description:
          "Adds a contact (new or existing) and an initial draft outreach message to the campaign, recomputes the outreach summary, emits an SSE update, and returns the created message.",
      },
    },
  )
  .patch(
    "/:id/outreach/:messageId",
    ({ profileId, params, body }) =>
      svc.patchOutreach(profileId, params.id, params.messageId, body),
    {
      params: outreachMessageParams,
      body: patchOutreachMessageSchema,
      response: outreachMessageSchema,
      detail: {
        summary: "Update outreach message",
        description:
          "Applies a non-terminal edit to an outreach message (draft body/subject, draft-to-approved, or the contact's LinkedIn connection state), recomputes the summary on status changes, and returns the updated message.",
      },
    },
  )
  .post(
    "/:id/outreach/:messageId/result",
    ({ profileId, params, body }) =>
      svc.recordOutreachResult(profileId, params.id, params.messageId, body),
    {
      params: outreachMessageParams,
      body: outreachMessageResultSchema,
      response: outreachMessageResultResponseSchema,
      detail: {
        summary: "Record outreach message result",
        description:
          "Records an outreach message's terminal outcome (sent/failed/skipped), stamps the send time and Gmail provider/thread ids, recomputes the summary, and returns the message and summary.",
      },
    },
  );
