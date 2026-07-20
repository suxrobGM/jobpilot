"use client";

import type { ReactNode } from "react";
import { Alert } from "@mui/material";
import type { Route } from "next";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { networkingSummary } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";

/** Surfaces campaigns that need user action. Renders nothing when all clear. */
export function AttentionStrip(): ReactNode {
  const campaigns = useApiQuery(campaignQueries.list());
  const rows = campaigns.data?.items ?? [];

  const draftCampaigns = rows.filter((c) => (networkingSummary(c)?.drafted ?? 0) > 0);
  if (draftCampaigns.length === 0) return null;

  const totalDrafts = draftCampaigns.reduce((n, c) => n + (networkingSummary(c)?.drafted ?? 0), 0);
  const only = draftCampaigns.length === 1 ? draftCampaigns[0] : undefined;

  return (
    <Alert
      severity="info"
      variant="outlined"
      action={
        only ? (
          <LinkButton
            size="small"
            color="inherit"
            href={`/campaigns/${encodeURIComponent(only.campaignId)}` as Route}
          >
            Review
          </LinkButton>
        ) : null
      }
    >
      {totalDrafts} networking draft{totalDrafts === 1 ? "" : "s"} awaiting send across{" "}
      {draftCampaigns.length} campaign{draftCampaigns.length === 1 ? "" : "s"}.
    </Alert>
  );
}
