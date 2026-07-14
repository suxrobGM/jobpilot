"use client";

import type { ReactNode } from "react";
import { Alert, Stack } from "@mui/material";
import type { Route } from "next";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";

/** Surfaces campaigns that need user action. Renders nothing when all clear. */
export function AttentionStrip(): ReactNode {
  const campaigns = useApiQuery(campaignQueries.list());
  const rows = campaigns.data ?? [];

  const interrupted = rows.filter((c) => c.status === "interrupted");
  const draftCampaigns = rows.filter((c) => c.source === "outreach" && c.summary.drafted > 0);
  const totalDrafts = draftCampaigns.reduce((n, c) => n + c.summary.drafted, 0);

  if (interrupted.length === 0 && draftCampaigns.length === 0) {
    return null;
  }

  const resumeHref = (c?: CampaignDto): Route | null =>
    c ? (`/campaigns/${encodeURIComponent(c.campaignId)}` as Route) : null;
  const firstInterrupted = resumeHref(interrupted[0]);
  const firstDraft = resumeHref(draftCampaigns[0]);

  return (
    <Stack spacing={1}>
      {interrupted.length > 0 && (
        <Alert
          severity="warning"
          variant="outlined"
          action={
            interrupted.length === 1 && firstInterrupted ? (
              <LinkButton size="small" color="inherit" href={firstInterrupted}>
                Resume
              </LinkButton>
            ) : null
          }
        >
          {interrupted.length} campaign{interrupted.length === 1 ? "" : "s"} interrupted - open one
          and Resume.
        </Alert>
      )}
      {draftCampaigns.length > 0 && (
        <Alert
          severity="info"
          variant="outlined"
          action={
            draftCampaigns.length === 1 && firstDraft ? (
              <LinkButton size="small" color="inherit" href={firstDraft}>
                Review
              </LinkButton>
            ) : null
          }
        >
          {totalDrafts} outreach draft{totalDrafts === 1 ? "" : "s"} awaiting send across{" "}
          {draftCampaigns.length} campaign{draftCampaigns.length === 1 ? "" : "s"}.
        </Alert>
      )}
    </Stack>
  );
}
