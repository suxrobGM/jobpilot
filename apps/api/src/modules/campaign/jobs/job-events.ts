import type { CampaignSummary } from "@jobpilot/contracts/campaign";
import { campaignChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";
import type { CampaignSource, PrismaClient } from "@/generated/prisma/client";
import { deriveCampaignSummary } from "../campaign.summary";
import { type JobRow, toCampaignJob } from "./job-row";

export function publishJob(userId: string, job: JobRow, kind: "added" | "updated"): void {
  const { campaignId } = job;
  publish(
    campaignChannel,
    { campaignId },
    { type: "job-update", payload: { kind, job: toCampaignJob(job) } },
  );
  publish(
    workspaceChannel,
    { userId },
    {
      type: kind === "added" ? "campaignjob.created" : "campaignjob.updated",
      campaignId,
      key: job.key,
      ...(kind === "updated" && { status: job.status }),
    },
  );
}

export async function publishProgress(
  prisma: PrismaClient,
  campaignId: string,
  source: CampaignSource,
): Promise<CampaignSummary> {
  const summary = await deriveCampaignSummary(prisma, campaignId, source);
  publish(campaignChannel, { campaignId }, { type: "progress", payload: summary });
  return summary;
}

/** Every status move publishes the row and the campaign totals, so other viewers' tiles stay live. */
export function publishStatusChange(
  prisma: PrismaClient,
  userId: string,
  job: JobRow,
  source: CampaignSource,
): Promise<CampaignSummary> {
  publishJob(userId, job, "updated");
  return publishProgress(prisma, job.campaignId, source);
}
