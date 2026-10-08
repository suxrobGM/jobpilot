import {
  addCampaignJobSchema,
  campaignJobResultSchema,
  patchCampaignJobSchema,
  rescanCampaignJobSchema,
  retryCampaignJobSchema,
} from "@jobpilot/contracts/campaign";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import {
  campaignJobListSchema,
  campaignJobParams,
  campaignJobReasonListSchema,
  campaignJobResultResponseSchema,
  campaignJobSchema,
  campaignJobsQuery,
} from "./job.schema";
import { CampaignJobService } from "./job.service";
import { CampaignJobQueryService } from "./job-query.service";

const svc = container.resolve(CampaignJobService);
const queries = container.resolve(CampaignJobQueryService);

export const campaignJobController = new Elysia({
  name: "campaign-jobs",
  prefix: "/campaigns",
  detail: { tags: ["Campaigns"] },
})
  .use(authGuard)
  .get("/:id/jobs", ({ user, params, query }) => queries.listJobs(user.id, params.id, query), {
    params: idParam,
    query: campaignJobsQuery,
    response: campaignJobListSchema,
    detail: {
      summary: "List campaign jobs",
      description:
        "Returns one page of jobs for the owned campaign, ordered by creation. Optional status and title/company search filters apply across the whole campaign.",
    },
  })
  .get("/:id/jobs/reasons", ({ user, params }) => queries.listJobReasons(user.id, params.id), {
    params: idParam,
    response: campaignJobReasonListSchema,
    detail: {
      summary: "List campaign skip/fail reasons",
      description: "Returns every skip and fail reason with its job count, most frequent first.",
    },
  })
  .post("/:id/jobs", ({ user, params, body }) => svc.addJob(user.id, params.id, body), {
    params: idParam,
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
    "/:id/jobs/:key/submit-attempt",
    ({ user, params }) => svc.markSubmitAttempt(user.id, params.id, params.key),
    {
      params: campaignJobParams,
      response: campaignJobSchema,
      detail: {
        summary: "Mark a job as about to be submitted",
        description:
          "Records that the agent is about to submit the application form. Call it immediately before the submit click: crash recovery uses it to tell the user the apply was interrupted mid-submit. 409 while the job is held waiting on a submitted-or-not answer.",
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
