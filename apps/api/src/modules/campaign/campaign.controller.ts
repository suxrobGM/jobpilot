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
import { CampaignService } from "./campaign.service";

const svc = container.resolve(CampaignService);

// `:id` is a string slug (campaignId), not a numeric row id.
const campaignParams = z.object({ id: z.string() });
const campaignJobParams = z.object({ id: z.string(), key: z.string() });
const outreachMessageParams = z.object({
  id: z.string(),
  messageId: z.coerce.number().int().positive(),
});
const campaignsQuery = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
});

export const campaignController = new Elysia({
  prefix: "/campaigns",
  detail: { tags: ["Campaigns"] },
})
  .use(profileGuard)
  // ── Collection ──────────────────────────────────────────────────────────────
  .get("/", ({ profileId, query }) => svc.list(profileId, query), { query: campaignsQuery })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), { body: createCampaignSchema })
  // ── Single campaign ───────────────────────────────────────────────────────────
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), { params: campaignParams })
  .patch("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: campaignParams,
    body: updateCampaignSchema,
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: campaignParams,
  })
  // ── Events (SSE stream + event record) ────────────────────────────────────────
  .get(
    "/:id/events",
    async ({ profileId, params }) => {
      await svc.ensureCampaignOwned(profileId, params.id);
      return sseResponse(subscribe(campaignChannel, { campaignId: params.id }));
    },
    { params: campaignParams },
  )
  .post(
    "/:id/events",
    ({ profileId, params, body }) => svc.recordCampaignEvent(profileId, params.id, body),
    { params: campaignParams, body: campaignEventSchema },
  )
  // ── Jobs ──────────────────────────────────────────────────────────────────
  .get("/:id/jobs", ({ profileId, params }) => svc.listJobs(profileId, params.id), {
    params: campaignParams,
  })
  .post("/:id/jobs", ({ profileId, params, body }) => svc.addJob(profileId, params.id, body), {
    params: campaignParams,
    body: addCampaignJobSchema,
  })
  .patch(
    "/:id/jobs/:key",
    ({ profileId, params, body }) => svc.patchJob(profileId, params.id, params.key, body),
    { params: campaignJobParams, body: patchCampaignJobSchema },
  )
  .post(
    "/:id/jobs/:key/result",
    ({ profileId, params, body }) => svc.recordJobResult(profileId, params.id, params.key, body),
    { params: campaignJobParams, body: campaignJobResultSchema },
  )
  // ── Outreach ────────────────────────────────────────────────────────────────
  .get("/:id/outreach", ({ profileId, params }) => svc.listOutreach(profileId, params.id), {
    params: campaignParams,
  })
  .post(
    "/:id/outreach",
    ({ profileId, params, body }) => svc.addOutreach(profileId, params.id, body),
    { params: campaignParams, body: addCampaignOutreachSchema },
  )
  .patch(
    "/:id/outreach/:messageId",
    ({ profileId, params, body }) =>
      svc.patchOutreach(profileId, params.id, params.messageId, body),
    { params: outreachMessageParams, body: patchOutreachMessageSchema },
  )
  .post(
    "/:id/outreach/:messageId/result",
    ({ profileId, params, body }) =>
      svc.recordOutreachResult(profileId, params.id, params.messageId, body),
    { params: outreachMessageParams, body: outreachMessageResultSchema },
  );
