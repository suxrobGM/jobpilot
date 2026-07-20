import { z } from "zod/v4";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";

export interface JobMutationDeps {
  prisma: PrismaClient;
  campaignJobs: CampaignJobService;
}

const jobPayloadSchema = z.object({
  campaignId: z.string().min(1),
  jobKey: z.string().min(1),
});

/** Validates the job reference carried by a typed lease payload. */
export function parseJobPayload(payload: unknown) {
  return jobPayloadSchema.parse(payload);
}
