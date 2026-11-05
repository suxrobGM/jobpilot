"use client";

import type { ReactNode } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { applicationQueries, campaignQueries } from "@/api/queries";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";

const KEYS = [campaignQueries.all, applicationQueries.all];

/** The workspace layout's one subscription: campaign and application events refresh both trees. */
export function WorkspaceLive(): ReactNode {
  useLiveInvalidation(workspaceChannel, null, {
    on: {
      "campaign.updated": KEYS,
      "campaign.completed": KEYS,
      "campaign.deleted": KEYS,
      "campaignjob.created": KEYS,
      "campaignjob.updated": KEYS,
      "application.created": KEYS,
    },
    onReconnect: KEYS,
  });
  return null;
}
