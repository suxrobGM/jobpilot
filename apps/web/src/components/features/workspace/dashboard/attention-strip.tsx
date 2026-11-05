"use client";

import type { ReactNode } from "react";
import { Alert } from "@mui/material";
import type { Route } from "next";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { plural } from "@/utils/format";

/** Surfaces campaigns that need user action. Renders nothing when all clear. */
export function AttentionStrip(): ReactNode {
  const summary = useApiQuery(campaignQueries.summary());
  const drafts = summary.data?.drafts;

  if (!drafts || drafts.messages === 0) {
    return null;
  }

  return (
    <Alert
      severity="info"
      variant="outlined"
      action={
        drafts.campaignId && (
          <LinkButton
            size="small"
            color="inherit"
            href={`/campaigns/${encodeURIComponent(drafts.campaignId)}` as Route}
          >
            Review
          </LinkButton>
        )
      }
    >
      {plural(drafts.messages, "networking message")} {drafts.messages === 1 ? "is" : "are"} drafted
      and waiting for you to send, in {plural(drafts.campaigns, "campaign")}.
    </Alert>
  );
}
