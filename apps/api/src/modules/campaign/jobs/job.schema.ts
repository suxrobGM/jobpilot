import { statusSchema } from "@jobpilot/contracts/application";
import { campaignSummarySchema } from "@jobpilot/contracts/campaign";
import { z } from "zod/v4";
import { paginatedResponseSchema } from "@/types/response";
import { campaignJobSchema } from "../campaign.schema";

/** A list of campaign jobs (the `listJobs` route). */
export const campaignJobListSchema = paginatedResponseSchema(campaignJobSchema);

/**
 * The raw `Application` Prisma row returned (un-serialized) inside a job-result
 * response. Dates remain `Date` objects because `recordJobResult` returns the
 * found/created row directly; `null` when the outcome was not `applied`.
 */
export const campaignApplicationSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    url: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().nullable(),
    board: z.string().nullable(),
    source: z.string(),
    appliedAt: z.date(),
    status: statusSchema,
    rejectedAt: z.date().nullable(),
    matchScore: z.number().int().nullable(),
    matchReason: z.string().nullable(),
    failReason: z.string().nullable(),
    campaignId: z.string().nullable(),
    normalizedTitle: z.string(),
    normalizedCompany: z.string(),
  })
  .nullable();

/**
 * Result of recording a job's terminal outcome - the updated job, the Application
 * row (when applied), and the current derived campaign summary.
 */
export const campaignJobResultResponseSchema = z.object({
  campaignJob: campaignJobSchema,
  application: campaignApplicationSchema,
  summary: campaignSummarySchema,
});
