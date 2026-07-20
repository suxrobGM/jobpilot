import {
  addCampaignJobSchema,
  campaignJobResultSchema,
  patchCampaignJobSchema,
  rescanCampaignJobSchema,
  retryCampaignJobSchema,
} from "@jobpilot/contracts/campaign";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import {
  campaignJobParams,
  campaignJobSchema,
  campaignJobsQuery,
  campaignParams,
} from "../campaign.schema";
import {
  campaignJobListSchema,
  campaignJobReasonListSchema,
  campaignJobResultResponseSchema,
} from "./job.schema";
import { CampaignJobService } from "./job.service";

const svc = container.resolve(CampaignJobService);

export const campaignJobController = new Elysia({
  name: "campaign-jobs",
  detail: { tags: ["Campaigns"] },
})
  .use(authGuard)
  .get("/:id/jobs", ({ user, params, query }) => svc.listJobs(user.id, params.id, query), {
    params: campaignParams,
    query: campaignJobsQuery,
    response: campaignJobListSchema,
    detail: {
      summary: "List campaign jobs",
      description:
        "Returns one page of jobs for the owned campaign, ordered by creation. Optional status and title/company search filters apply across the whole campaign.",
    },
  })
  .get("/:id/jobs/reasons", ({ user, params }) => svc.listJobReasons(user.id, params.id), {
    params: campaignParams,
    response: campaignJobReasonListSchema,
    detail: {
      summary: "List campaign skip/fail reasons",
      description: "Returns every skip and fail reason with its job count, most frequent first.",
    },
  })
  .post("/:id/jobs", ({ user, params, body }) => svc.addJob(user.id, params.id, body), {
    params: campaignParams,
    body: addCampaignJobSchema,
    response: campaignJobSchema,
    detail: {
      summary: "Add campaign job",
      description:
        "Adds a discovered job to the campaign, consumes its matching pending queue entry, emits SSE updates, and returns the created job.",
    },
  })
  .patch(
    "/:id/jobs/:key",
    ({ user, params, body }) => svc.patchJob(user.id, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: patchCampaignJobSchema,
      response: campaignJobSchema,
      detail: {
        summary: "Update campaign job",
        description:
          "Applies a validated non-terminal status transition or content update, emits SSE updates, and returns the updated job. Terminal outcomes are accepted only by the result route.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/result",
    ({ user, params, body }) => svc.recordJobResult(user.id, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: campaignJobResultSchema,
      response: campaignJobResultResponseSchema,
      detail: {
        summary: "Record campaign job result",
        description:
          "Conditionally records an idempotent terminal outcome, atomically upserts the Application and initial event when applied, marks the queue entry, and returns the current derived summary.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/retry",
    ({ user, params, body }) => svc.retryJob(user.id, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: retryCampaignJobSchema,
      response: campaignJobSchema,
      detail: {
        summary: "Retry a failed campaign job",
        description:
          "Conditionally returns a failed job to the approved queue and clears its terminal failure fields. This is the only failed-to-active transition.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/rescan",
    ({ user, params, body }) => svc.rescanJob(user.id, params.id, params.key, body),
    {
      params: campaignJobParams,
      body: rescanCampaignJobSchema,
      response: campaignJobSchema,
      detail: {
        summary: "Record a skipped-job rescan",
        description:
          "Conditionally records a fresh score for a skipped job and either promotes it to approved or keeps it skipped with a new reason.",
      },
    },
  );
