import {
  addCampaignJobSchema,
  campaignJobResultSchema,
  patchCampaignJobSchema,
} from "@jobpilot/contracts/campaign";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { campaignJobParams, campaignParams } from "../campaign.schema";
import { CampaignJobService } from "./job.service";

const svc = container.resolve(CampaignJobService);

export const campaignJobController = new Elysia({
  name: "campaign-jobs",
  detail: { tags: ["Campaigns"] },
})
  .use(profileGuard)
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
  );
