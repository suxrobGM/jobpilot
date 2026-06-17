import {
  campaignEventSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "@jobpilot/contracts/campaign";
import { Elysia, sse } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { subscribe } from "@/common/sse";
import { campaignChannel } from "@/common/sse/channels/campaign";
import { idResponseSchema } from "@/types/response";
import {
  campaignCreatedSchema,
  campaignDeletedSchema,
  campaignListSchema,
  campaignParams,
  campaignSchema,
  campaignsQuery,
  campaignWithJobsSchema,
} from "./campaign.schema";
import { CampaignService } from "./campaign.service";
import { campaignJobController } from "./jobs/job.controller";
import { campaignOutreachController } from "./outreach/outreach.controller";

const svc = container.resolve(CampaignService);

export const campaignController = new Elysia({
  prefix: "/campaigns",
  detail: { tags: ["Campaigns"] },
})
  .use(profileGuard)
  // ── Collection ──────────────────────────────────────────────────────────────
  .get("/", ({ profileId, query }) => svc.list(profileId, query), {
    query: campaignsQuery,
    response: campaignListSchema,
    detail: {
      summary: "List campaigns",
      description:
        "Returns the profile's campaigns (optionally filtered by status and source), reconciling any stale in-progress campaigns to interrupted before responding.",
    },
  })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: createCampaignSchema,
    response: campaignCreatedSchema,
    detail: {
      summary: "Create campaign",
      description: "Creates a new campaign for the profile and returns the created campaign row.",
    },
  })
  // ── Single campaign ───────────────────────────────────────────────────────────
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: campaignParams,
    response: campaignWithJobsSchema,
    detail: {
      summary: "Get campaign",
      description:
        "Returns a single owned campaign with its jobs and a derived summary, or 404 if it is not owned by the profile.",
    },
  })
  .patch("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: campaignParams,
    body: updateCampaignSchema,
    response: campaignSchema,
    detail: {
      summary: "Update campaign",
      description:
        "Updates a campaign's status, summary, config, or completion time, emits status/progress events, and returns the updated campaign.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: campaignParams,
    response: campaignDeletedSchema,
    detail: {
      summary: "Delete campaign",
      description:
        "Hard-deletes the campaign and its related jobs, events, applications, outreach messages, and campaign-only contacts, returning a deletion acknowledgement.",
    },
  })
  // ── Events (SSE stream + event record) ────────────────────────────────────────
  .get(
    "/:id/events",
    async ({ profileId, params }) => {
      await svc.ensureCampaignOwned(profileId, params.id);
      return sse(subscribe(campaignChannel, { campaignId: params.id }));
    },
    {
      params: campaignParams,
      detail: {
        summary: "Stream campaign events",
        description:
          "Opens a Server-Sent Events stream of live campaign events (status, progress, job, and outreach updates) for the owned campaign.",
      },
    },
  )
  .post(
    "/:id/events",
    ({ profileId, params, body }) => svc.recordCampaignEvent(profileId, params.id, body),
    {
      params: campaignParams,
      body: campaignEventSchema,
      response: idResponseSchema,
      detail: {
        summary: "Record campaign event",
        description:
          "Persists a campaign event, broadcasts it to the campaign's SSE subscribers, and returns the new event id.",
      },
    },
  )
  // ── Sub-domain controllers (jobs, outreach) ───────────────────────────────────
  .use(campaignJobController)
  .use(campaignOutreachController);
