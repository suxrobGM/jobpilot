import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { MarketingFrame, MarketingMain } from "@/components/layout";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Page not found",
};

/** `proxy.ts` also serves this for missing jobs and portfolios. */
export default function NotFound(): ReactElement {
  return (
    <MarketingFrame>
      <MarketingMain maxWidth="md">
        <EmptyState
          title="Page not found"
          description="This page doesn't exist, or the job listing was taken down."
          action={
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
              <LinkButton href="/jobs" variant="contained">
                Browse jobs
              </LinkButton>
              <LinkButton href="/" variant="outlined">
                Home
              </LinkButton>
            </Stack>
          }
        />
      </MarketingMain>
    </MarketingFrame>
  );
}
