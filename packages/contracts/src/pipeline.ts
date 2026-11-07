import { z } from "zod/v4";
import { type JobStatus, jobSchema, MAX_LINKS } from "./feed";
import { MAX_PAGE_SIZE, paginatedSchema, paginationQuerySchema } from "./pagination";

/**
 * Review, In progress and Set aside are the Pipeline's tabs; Needs you feeds the banner and nav badge.
 * Applied lists applications, so it isn't a job view.
 */
const PIPELINE_JOB_VIEWS = ["review", "inProgress", "setAside", "needsYou"] as const;
const pipelineJobViewSchema = z.enum(PIPELINE_JOB_VIEWS);
export type PipelineJobView = z.infer<typeof pipelineJobViewSchema>;

export const PIPELINE_VIEW_STATUSES: Record<PipelineJobView, JobStatus[]> = {
  review: ["queued", "pending"],
  inProgress: ["approved", "applying", "needs_user"],
  setAside: ["skipped", "failed"],
  needsYou: ["needs_user"],
};

/** A To review job found longer ago than this may have a closed posting. */
export const PIPELINE_STALE_DAYS = 30;

const pipelineFiltersSchema = z.object({
  feedId: z.uuid().optional(),
  board: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const pipelineJobsQuerySchema = paginationQuerySchema
  .extend({ view: pipelineJobViewSchema })
  .extend(pipelineFiltersSchema.shape);
export type PipelineJobsQuery = z.infer<typeof pipelineJobsQuerySchema>;

export const pipelineCountsQuerySchema = pipelineFiltersSchema;
export type PipelineFilters = z.infer<typeof pipelineFiltersSchema>;

/** `minScore` is the bar this job's feed applies: its own override, else the pilot's. */
const pipelineJobSchema = jobSchema.extend({
  feed: z.object({ id: z.uuid(), name: z.string() }),
  minScore: z.number().int(),
});

export const pipelineJobListSchema = paginatedSchema(pipelineJobSchema);
const viewCountsSchema = z.record(pipelineJobViewSchema, z.number().int());

export const pipelineCountsSchema = z.object({
  views: viewCountsSchema,
  /** Per feed, ignoring the feed filter, so the feed menu can list every one. */
  feeds: z.array(z.object({ feedId: z.uuid(), views: viewCountsSchema })),
  /** To review jobs found over `PIPELINE_STALE_DAYS` ago. */
  stale: z.number().int(),
});
export const needsYouJobRefsSchema = z.array(z.object({ feedId: z.uuid(), key: z.string() }));

export const addPipelineLinksSchema = z.object({
  urls: z.array(z.url()).min(1).max(MAX_LINKS),
});

/** `duplicates` are links the user already had from the last 30 days. */
export const addedPipelineLinksSchema = z.object({
  feedId: z.uuid(),
  added: z.number().int(),
  duplicates: z.array(z.string()),
});

/** Approve acts on To review rows, skip on those and approved ones, retry on failed ones. */
const PIPELINE_BULK_ACTIONS = ["approve", "skip", "retry"] as const;

export const pipelineBulkSchema = z.object({
  action: z.enum(PIPELINE_BULK_ACTIONS),
  ids: z.array(z.uuid()).min(1).max(MAX_PAGE_SIZE),
});
export type PipelineBulkInput = z.infer<typeof pipelineBulkSchema>;

/** Skips every stale To review job under the filters, past any page. */
export const pipelineSkipStaleSchema = pipelineFiltersSchema;

/** `refused` counts rows whose status no longer allowed the action. */
export const pipelineBulkResultSchema = z.object({
  updated: z.number().int(),
  refused: z.number().int(),
});
