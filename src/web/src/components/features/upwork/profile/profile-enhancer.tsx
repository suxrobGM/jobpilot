"use client";

import type { ReactElement } from "react";
import { AutoFixHigh } from "@mui/icons-material";
import { Box, Button, Chip, LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { UpworkProfileStatus } from "@/api/contracts/upwork";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { UpworkProfileDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { upworkChannel } from "@/lib/sse/channels/upwork";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent } from "@/providers/agent-provider";
import { ProfileReview } from "./profile-review";

const STATUS_COLOR: Record<UpworkProfileStatus, "default" | "info" | "warning" | "success"> = {
  empty: "default",
  draft: "info",
  approved: "warning",
  applied: "success",
};

const STATUS_LABEL: Record<UpworkProfileStatus, string> = {
  empty: "Not generated",
  draft: "Draft — review",
  approved: "Approved — ready to apply",
  applied: "Applied to Upwork",
};

/** Loads the profile-enhancement record, streams live updates, and renders the review. */
export function ProfileEnhancer(): ReactElement {
  const agent = useAgent();
  const queryClient = useQueryClient();

  useSseChannel(upworkChannel, null, {
    on: {
      "profile.updated": () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.upworkProfile.all }),
    },
  });

  const query = useApiQuery<UpworkProfileDto | null>(queryKeys.upworkProfile.detail(), () =>
    apiClient.get<UpworkProfileDto | null>("/api/upwork/profile"),
  );

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
          <Chip
            size="small"
            label={STATUS_LABEL[status]}
            color={STATUS_COLOR[status]}
            variant="outlined"
          />
          <Box sx={{ flex: 1 }} />
          <Button
            variant={hasSuggestion ? "text" : "contained"}
            startIcon={<AutoFixHigh fontSize="sm" />}
            onClick={() => void agent.injectSkill("upwork-profile")}
          >
            {hasSuggestion ? "Re-generate" : "Generate suggestions"}
          </Button>
        </Stack>

        {hasSuggestion && profile ? (
          <ProfileReview key={profile.updatedAt} profile={profile} />
        ) : (
          <EmptyState
            variant="inline"
            title="No suggestions yet."
            description="Run “Generate suggestions” — the agent reads your live Upwork profile and résumé, then drafts an improved overview and portfolio for review."
          />
        )}
      </Stack>
    </SectionCard>
  );
}
