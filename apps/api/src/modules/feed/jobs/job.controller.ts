import {
  addedJobSchema,
  addJobSchema,
  jobResultSchema,
  jobSchema,
  patchJobSchema,
  rescanJobSchema,
  retryJobSchema,
} from "@jobpilot/contracts/feed";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import {
  jobListSchema,
  jobParams,
  jobReasonListSchema,
  jobResultResponseSchema,
  jobsQuery,
} from "./job.schema";
import { JobService } from "./job.service";
import { JobQueryService } from "./job-query.service";

const jobs = container.get(JobService);
const queries = container.get(JobQueryService);

export const jobController = new Elysia({
  name: "jobs",
  prefix: "/feeds",
  detail: { tags: ["Feeds"] },
})
  .use(authGuard)
  .get("/:id/jobs", ({ user, params, query }) => queries.list(user.id, params.id, query), {
    params: idParam,
    query: jobsQuery,
    response: jobListSchema,
    detail: {
      summary: "List feed jobs",
      description:
        "Returns one page of jobs for the owned feed, ordered by creation. Optional status and title/company search filters apply across the whole feed.",
    },
  })
  .get("/:id/job-reasons", ({ user, params }) => queries.listReasons(user.id, params.id), {
    params: idParam,
    response: jobReasonListSchema,
    detail: {
      summary: "List feed skip/fail reasons",
      description: "Returns every skip and fail reason with its job count, most frequent first.",
    },
  })
  .post("/:id/jobs", ({ user, params, body }) => jobs.add(user.id, params.id, body), {
    params: idParam,
    body: addJobSchema,
    response: addedJobSchema,
    detail: {
      summary: "Add feed job",
      description:
        "Adds a discovered job to the feed and emits SSE updates. When the user already has the same normalized URL from the last 30 days, returns that job with duplicate: true and adds nothing.",
    },
  })
  .patch(
    "/:id/jobs/:key",
    ({ user, params, body }) => jobs.update(user.id, params.id, params.key, body),
    {
      params: jobParams,
      body: patchJobSchema,
      response: jobSchema,
      detail: {
        summary: "Update feed job",
        description:
          "Applies a validated non-terminal status transition or content update, emits SSE updates, and returns the updated job. Terminal outcomes are accepted only by the result route.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/result",
    ({ user, params, body }) => jobs.recordResult(user.id, params.id, params.key, body),
    {
      params: jobParams,
      body: jobResultSchema,
      response: jobResultResponseSchema,
      detail: {
        summary: "Record feed job result",
        description:
          "Conditionally records an idempotent terminal outcome, atomically upserts the Application and initial event when applied, marks the queue entry, and returns the current derived summary.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/retry",
    ({ user, params, body }) => jobs.retry(user.id, params.id, params.key, body),
    {
      params: jobParams,
      body: retryJobSchema,
      response: jobSchema,
      detail: {
        summary: "Retry a failed feed job",
        description:
          "Conditionally returns a failed job to the approved queue and clears its terminal failure fields. This is the only failed-to-active transition.",
      },
    },
  )
  .post(
    "/:id/jobs/:key/rescan",
    ({ user, params, body }) => jobs.rescan(user.id, params.id, params.key, body),
    {
      params: jobParams,
      body: rescanJobSchema,
      response: jobSchema,
      detail: {
        summary: "Record a skipped-job rescan",
        description:
          "Conditionally records a fresh score for a skipped job and either promotes it to approved or keeps it skipped with a new reason.",
      },
    },
  );
