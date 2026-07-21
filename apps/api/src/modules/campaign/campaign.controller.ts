import {
  campaignStatusCommandSchema,
  createCampaignSchema,
  updateCampaignConfigSchema,
} from "@jobpilot/contracts/campaign";
import { campaignChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard, requireVerifiedEmail } from "@/common/middleware";
import { sseStream } from "@/common/sse";
import {
  campaignDeletedSchema,
  campaignListSchema,
  campaignParams,
  campaignSchema,
  campaignsQuery,
} from "./campaign.schema";
import { CampaignService } from "./campaign.service";

const svc = container.resolve(CampaignService);

export const campaignController = new Elysia({
  prefix: "/campaigns",
  detail: { tags: ["Campaigns"] },
})
  .use(authGuard)
  .get("/", ({ user, query }) => svc.list(user.id, query), {
    query: campaignsQuery,
    response: campaignListSchema,
    detail: {
      summary: "List campaigns",
      description:
        "Returns one validated page of owned campaigns with summaries derived from current job or networking rows.",
    },
  })
  .post(
    "/",
    async ({ user, body }) => {
      await requireVerifiedEmail(user.id);
      return svc.create(user.id, body);
    },
    {
      body: createCampaignSchema,
      response: campaignSchema,
      detail: {
        summary: "Create campaign",
        description:
          "Creates a server-identified campaign and returns the same parsed campaign DTO used by every campaign route.",
      },
    },
  )
  .get("/:id", ({ user, params }) => svc.get(user.id, params.id), {
    params: campaignParams,
    response: campaignSchema,
    detail: {
      summary: "Get campaign",
      description:
        "Returns one owned campaign with its current derived summary; jobs and networking messages are paginated subresources.",
    },
  })
  .patch("/:id", ({ user, params, body }) => svc.updateConfig(user.id, params.id, body), {
    params: campaignParams,
    body: updateCampaignConfigSchema,
    response: campaignSchema,
    detail: {
      summary: "Replace campaign configuration",
      description:
        "Replaces the campaign configuration with a fully validated configuration without changing lifecycle status.",
    },
  })
  .post("/:id/status", ({ user, params, body }) => svc.commandStatus(user.id, params.id, body), {
    params: campaignParams,
    body: campaignStatusCommandSchema,
    response: campaignSchema,
    detail: {
      summary: "Transition campaign status",
      description:
        "Applies a validated, conditional lifecycle transition and rejects invalid or concurrent transitions.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: campaignParams,
    response: campaignDeletedSchema,
    detail: {
      summary: "Delete campaign",
      description:
        "Deletes the owned campaign and its campaign-scoped jobs, applications, networking messages, and orphaned contacts.",
    },
  })
  .get(
    "/:id/events",
    async ({ user, params, headers }) => {
      await svc.ensureCampaignOwned(user.id, params.id);
      return sseStream(campaignChannel, { campaignId: params.id }, headers);
    },
    {
      params: campaignParams,
      detail: {
        summary: "Stream campaign events",
        description:
          "Streams live campaign status, progress, job, and networking updates without persisting an event log.",
      },
    },
  );
