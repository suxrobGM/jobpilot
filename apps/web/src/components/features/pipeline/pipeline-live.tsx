"use client";

import type { ReactNode } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { applicationQueries, campaignQueries, pipelineQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";

const JOB_KEYS = [pipelineQueries.all];
const ALL_KEYS = [pipelineQueries.all, campaignQueries.all, applicationQueries.all];

/** The app's one subscription for job, campaign and application events. */
export function PipelineLive(): ReactNode {
  useLiveInvalidation(workspaceChannel, null, {
    on: {
      "campaign.updated": [campaignQueries.all],
      "campaign.completed": [campaignQueries.all],
      "campaign.deleted": ALL_KEYS,
      "campaignjob.created": JOB_KEYS,
      "campaignjob.updated": JOB_KEYS,
      "application.created": ALL_KEYS,
    },
    onReconnect: ALL_KEYS,
  });
  return null;
}
