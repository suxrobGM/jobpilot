"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import type { UpworkProfileStatus } from "@jobpilot/contracts/upwork";
import { AutoFixHigh } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { upworkProfileQueries } from "@/api/queries";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { ProfileReview } from "./profile-review";

/** Loads the profile-enhancement record, streams live updates, and renders the review. */
export function ProfileEnhancer(): ReactElement {
  const request = useCreateRequest();

  useLiveInvalidation(upworkChannel, null, {
    on: { "profile.updated": [upworkProfileQueries.all] },
  });

  const query = useQuery(upworkProfileQueries.detail());

  if (query.isLoading) {
    return (
      <SectionCard>
        <LinearProgress />
      </SectionCard>
    );
  }

  const profile = query.data ?? null;
  const status: UpworkProfileStatus = profile?.status ?? "empty";
  const hasSuggestion = Boolean(
    profile &&
      (profile.suggestedTitle || profile.suggestedOverview || profile.suggestedPortfolio.length),
  );

  return (
    <SectionCard
      title="Profile"
      description="Generate an improved Upwork overview and portfolio from your résumé, review it, then apply it to your live profile."
    >
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <StatusChip domain="upworkProfile" value={status} />
          <Box sx={{ flex: 1 }} />
          <Button
            variant={hasSuggestion ? "text" : "contained"}
            startIcon={<AutoFixHigh fontSize="sm" />}
            loading={request.isPending}
            onClick={() =>
              request.mutate({ taskType: "upwork.profile", payload: { mode: "review" } })
            }
          >
            {hasSuggestion ? "Re-generate" : "Generate suggestions"}
          </Button>
        </Stack>

        {hasSuggestion && profile ? (
          <ProfileReview key={String(profile.updatedAt)} profile={profile} />
        ) : (
          <EmptyState
            variant="inline"
            title="No suggestions yet."
            description="Run “Generate suggestions” - the agent reads your live Upwork profile and résumé, then drafts an improved overview and portfolio for review."
          />
        )}
      </Stack>
    </SectionCard>
  );
}
