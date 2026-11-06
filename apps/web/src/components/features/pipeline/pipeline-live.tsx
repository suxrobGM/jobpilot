"use client";

import type { ReactNode } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { applicationQueries, feedQueries, pipelineQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";

const JOB_KEYS = [pipelineQueries.all];
const ALL_KEYS = [pipelineQueries.all, feedQueries.all, applicationQueries.all];

/** The app's one subscription for job, feed and application events. */
export function PipelineLive(): ReactNode {
  useLiveInvalidation(workspaceChannel, null, {
    on: {
      "feed.updated": [feedQueries.all],
      "job.created": JOB_KEYS,
      "job.updated": JOB_KEYS,
      "application.created": ALL_KEYS,
    },
    onReconnect: ALL_KEYS,
  });
  return null;
}
