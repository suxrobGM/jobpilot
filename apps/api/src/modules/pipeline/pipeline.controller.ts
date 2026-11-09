import {
  addedPipelineLinksSchema,
  addPipelineLinksSchema,
  needsYouJobRefsSchema,
  pipelineBulkResultSchema,
  pipelineBulkSchema,
  pipelineCountsSchema,
  pipelineFiltersSchema,
  pipelineJobListSchema,
  pipelineJobSchema,
  pipelineJobsQuerySchema,
} from "@jobpilot/contracts/pipeline";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PipelineService } from "./pipeline.service";

const pipeline = container.get(PipelineService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pipelineController = new Elysia({
  prefix: "/pipeline",
  detail: { tags: ["Pipeline"] },
})
  .use(authGuard)
  .get("/jobs", ({ user, query }) => pipeline.list(user.id, query), {
    query: pipelineJobsQuerySchema,
    response: pipelineJobListSchema,
    detail: {
      summary: "List pipeline jobs",
      description:
        "One page of the user's jobs across searches and feeds in one view (review, inProgress, notApplied, needsYou). A posting in several feeds shows once, as its most advanced copy. Networking feeds are left out; Upwork jobs stay in for their proposal action.",
    },
  })
  .get("/jobs/:id", ({ user, params }) => pipeline.get(user.id, params.id), {
    params: idParam,
    response: pipelineJobSchema,
    detail: {
      summary: "Get a pipeline job",
      description: "One job by id, whatever its status or feed, as the pipeline lists it.",
    },
  })
  .get("/counts", ({ user, query }) => pipeline.counts(user.id, query), {
    query: pipelineFiltersSchema,
    response: pipelineCountsSchema,
    detail: {
      summary: "Count pipeline jobs per view",
      description:
        "Job counts for every view, plus To review jobs found over a month ago, under the same filters and dedupe as the list.",
    },
  })
  .get("/needs-you", ({ user }) => pipeline.needsYouRefs(user.id), {
    response: needsYouJobRefsSchema,
    detail: {
      summary: "List Needs you job refs",
      description:
        "Feed id and key of every job waiting on the user, under the list's dedupe. Lighter than the jobs list, for badges.",
    },
  })
  .post("/links", ({ user, body }) => pipeline.addLinks(user.id, body.urls), {
    body: addPipelineLinksSchema,
    beforeHandle: limitMutation,
    response: addedPipelineLinksSchema,
    detail: {
      summary: "Add job links",
      description:
        "Queues the links on the standing links feed for the pilot to score. Links the user already has from the last 30 days are reported in duplicates and not added again.",
    },
  })
  .post("/jobs/bulk", ({ user, body }) => pipeline.bulk(user.id, body), {
    body: pipelineBulkSchema,
    beforeHandle: limitMutation,
    response: pipelineBulkResultSchema,
    detail: {
      summary: "Approve, skip or retry jobs",
      description:
        "Applies one action to up to a page of jobs through the normal transitions. Rows whose status no longer allows it are counted in refused.",
    },
  })
  .post("/jobs/skip-stale", ({ user, body }) => pipeline.skipStale(user.id, body), {
    body: pipelineFiltersSchema,
    beforeHandle: limitMutation,
    response: pipelineBulkResultSchema,
    detail: {
      summary: "Skip stale jobs",
      description:
        "Skips every To review job found over a month ago under the filters, across all pages. Rows the pilot picked up meanwhile are counted in refused.",
    },
  });
