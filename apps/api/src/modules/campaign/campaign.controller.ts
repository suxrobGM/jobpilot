import {
  addCampaignJobSchema,
  campaignEventSchema,
  campaignJobResultSchema,
  createCampaignSchema,
  patchCampaignJobSchema,
  updateCampaignSchema,
} from "@jobpilot/contracts/campaign";
import {
  addCampaignOutreachSchema,
  outreachMessageResultSchema,
  patchOutreachMessageSchema,
} from "@jobpilot/contracts/outreach";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { sseResponse, subscribe } from "@/common/sse";
import { campaignChannel } from "@/common/sse/channels/campaign";
import {
  campaignJobParams,
  campaignParams,
  campaignsQuery,
  outreachMessageParams,
} from "./campaign.schema";
import { CampaignService } from "./campaign.service";

const svc = container.resolve(CampaignService);

export const campaignController = new Elysia({
  prefix: "/campaigns",
  detail: { tags: ["Campaigns"] },
})
  .use(profileGuard)
  // ── Collection ──────────────────────────────────────────────────────────────
  .get("/", ({ profileId, query }) => svc.list(profileId, query), {
    query: campaignsQuery,
    detail: {
      summary: "List campaigns",
      description:
        "Returns the profile's campaigns (optionally filtered by status and source), reconciling any stale in-progress campaigns to interrupted before responding.",
    },
  })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: createCampaignSchema,
    detail: {
      summary: "Create campaign",
      description: "Creates a new campaign for the profile and returns the created campaign row.",
    },
  })
  // ── Single campaign ───────────────────────────────────────────────────────────
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: campaignParams,
    detail: {
      summary: "Get campaign",
      description:
        "Returns a single owned campaign with its jobs and a derived summary, or 404 if it is not owned by the profile.",
    },
  })
  .patch("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: campaignParams,
    body: updateCampaignSchema,
    detail: {
      summary: "Update campaign",
      description:
        "Updates a campaign's status, summary, config, or completion time, emits status/progress events, and returns the updated campaign.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: campaignParams,
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
      return sseResponse(subscribe(campaignChannel, { campaignId: params.id }));
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
      detail: {
        summary: "Record campaign event",
        description:
          "Persists a campaign event, broadcasts it to the campaign's SSE subscribers, and returns the new event id.",
      },
    },
  )
  // ── Jobs ──────────────────────────────────────────────────────────────────
  .get("/:id/jobs", ({ profileId, params }) => svc.listJobs(profileId, params.id), {
    params: campaignParams,
    detail: {
      summary: "List campaign jobs",
      description: "Returns all queued jobs for the owned campaign, ordered by creation.",
    },
  })
  .post("/:id/jobs", ({ profileId, params, body }) => svc.addJob(profileId, params.id, body), {
    params: campaignParams,
    body: addCampaignJobSchema,
    detail: {
      summary: "Add campaign job",
      description:
        "Adds a discovered job to the campaign, consumes its matching pending queue entry, emits SSE updates, and returns the created job.",
    },
  })
  .patch(
    "/:id/jobs/:key",
    ({ profileId, params, body }) => svc.patchJob(profileId, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: patchCampaignJobSchema,
      detail: {
        summary: "Update campaign job",
        description:
          "Applies a non-terminal update to a campaign job (e.g. status, match data, notes), recomputes the summary on status changes, emits SSE updates, and returns the updated job.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/result",
    ({ profileId, params, body }) => svc.recordJobResult(profileId, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: campaignJobResultSchema,
      detail: {
        summary: "Record campaign job result",
        description:
          "Records a job's terminal outcome (applied/failed/skipped), upserts the Application row when applied, marks the queue entry, recomputes the summary, and returns the job, application, and summary.",
      },
    },
  )
  // ── Outreach ────────────────────────────────────────────────────────────────
  .get("/:id/outreach", ({ profileId, params }) => svc.listOutreach(profileId, params.id), {
    params: campaignParams,
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
      detail: {
        summary: "Record outreach message result",
        description:
          "Records an outreach message's terminal outcome (sent/failed/skipped), stamps the send time and Gmail provider/thread ids, recomputes the summary, and returns the message and summary.",
      },
    },
  );
