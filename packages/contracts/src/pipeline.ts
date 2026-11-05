import { z } from "zod/v4";
import { type CampaignJobStatus, campaignJobSchema, MAX_APPLY_URLS } from "./campaign";
import { paginatedSchema, paginationQuerySchema } from "./pagination";

/** Applied lists applications, so it isn't a job view. */
export const PIPELINE_JOB_VIEWS = ["found", "toApply", "needsYou", "skipped", "failed"] as const;
const pipelineJobViewSchema = z.enum(PIPELINE_JOB_VIEWS);
export type PipelineJobView = z.infer<typeof pipelineJobViewSchema>;

export const PIPELINE_VIEW_STATUSES: Record<PipelineJobView, CampaignJobStatus[]> = {
  found: ["queued", "pending"],
  toApply: ["approved", "applying"],
  needsYou: ["needs_user"],
  skipped: ["skipped"],
  failed: ["failed"],
};

const pipelineFiltersSchema = z.object({
  campaignId: z.uuid().optional(),
  board: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const pipelineJobsQuerySchema = paginationQuerySchema
  .extend({ view: pipelineJobViewSchema })
  .extend(pipelineFiltersSchema.shape);
export type PipelineJobsQuery = z.infer<typeof pipelineJobsQuerySchema>;

export const pipelineCountsQuerySchema = pipelineFiltersSchema;
export type PipelineFilters = z.infer<typeof pipelineFiltersSchema>;

const pipelineJobSchema = campaignJobSchema.extend({
  campaign: z.object({ id: z.uuid(), query: z.string() }),
});

export const pipelineJobListSchema = paginatedSchema(pipelineJobSchema);
export const pipelineCountsSchema = z.record(pipelineJobViewSchema, z.number().int());

export const addPipelineLinksSchema = z.object({
  urls: z.array(z.url()).min(1).max(MAX_APPLY_URLS),
});

/** `duplicates` are links the user already had from the last 30 days. */
export const addedPipelineLinksSchema = z.object({
  campaignId: z.uuid(),
  added: z.number().int(),
  duplicates: z.array(z.string()),
});
