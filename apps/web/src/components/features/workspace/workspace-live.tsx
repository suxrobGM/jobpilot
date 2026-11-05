"use client";

import type { ReactNode } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { applicationQueries, campaignQueries, FULL_PAGE } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";

const CAMPAIGN_KEYS = [campaignQueries.all];
const ALL_KEYS = [campaignQueries.all, applicationQueries.all];
// Fires per job during a scoring pass, so it refreshes only what a running campaign shows.
const RUNNING_CAMPAIGN_KEYS = [
  campaignQueries.list({ ...FULL_PAGE, status: ["in_progress"] }).queryKey,
  campaignQueries.summary().queryKey,
];

/** The workspace layout's one subscription for campaign and application events. */
export function WorkspaceLive(): ReactNode {
  useLiveInvalidation(workspaceChannel, null, {
    on: {
      "campaign.updated": CAMPAIGN_KEYS,
      "campaign.completed": CAMPAIGN_KEYS,
      "campaign.deleted": ALL_KEYS,
      "campaignjob.created": RUNNING_CAMPAIGN_KEYS,
      "campaignjob.updated": RUNNING_CAMPAIGN_KEYS,
      "application.created": ALL_KEYS,
    },
    onReconnect: ALL_KEYS,
  });
  return null;
}
