"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Stop } from "@mui/icons-material";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@/api/client";
import { api } from "@/api/eden";
import type { CampaignSource, CampaignStatus } from "@jobpilot/contracts/campaign";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto } from "@/api/types";
import { DOCK_COLLAPSED, DOCK_EXPANDED } from "@/components/layout/shell-config";
import { pipelineChannel } from "@/lib/sse/channels/pipeline";
import { useSseChannel } from "@/lib/sse/client";
import { readAgentStorage, subscribeAgentStorage } from "@/providers/agent-provider";

const FILTERS = {
  status: "in_progress" satisfies CampaignStatus,
  source: "auto-apply" satisfies CampaignSource,
} as const;

export function AutoApplyStopPill(): ReactNode {
  const queryClient = useQueryClient();

  const dockWidth = useSyncExternalStore(
    subscribeAgentStorage,
    () => readAgentStorage()?.dockWidth ?? DOCK_EXPANDED,
    () => DOCK_EXPANDED,
  );
  const dockExpanded = useSyncExternalStore(
    subscribeAgentStorage,
    () => readAgentStorage()?.dockExpanded ?? false,
    () => false,
  );
  const rightOffset = (dockExpanded ? dockWidth : DOCK_COLLAPSED) + 16;

  const invalidateCampaigns = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
  };
  useSseChannel(pipelineChannel, null, {
    on: {
      "campaign.updated": invalidateCampaigns,
      "campaign.completed": invalidateCampaigns,
    },
  });

  const campaigns = useApiQuery<CampaignDto[]>(queryKeys.campaigns.list(FILTERS), () =>
    unwrap(
      api.campaigns.get({ query: { status: FILTERS.status, source: FILTERS.source } }),
    ),
  );

  const active = campaigns.data?.[0] ?? null;

  const stop = useApiMutation<{ campaignId: string; status: string }, void>(
    () => {
      if (!active) {
        return Promise.resolve({
          data: null,
          error: { code: "NO_CAMPAIGN", message: "No active auto-apply campaign" },
        });
      }
      return unwrap(
        api.campaigns({ id: active.campaignId }).patch({
          status: "paused" satisfies CampaignStatus,
        }),
      );
    },
    {
      successMessage: "Auto-apply paused",
      invalidate: [queryKeys.campaigns.all, queryKeys.pipeline.all],
    },
  );

  if (!active) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      sx={(t) => ({
        position: "fixed",
        bottom: 16,
        right: rightOffset,
        zIndex: t.zIndex.snackbar,
        borderRadius: t.radii.md,
        padding: 1.5,
        backgroundColor: t.palette.background.paper,
        border: `1px solid ${t.palette.line.divider}`,
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Stack spacing={0}>
          <Typography variant="captionMuted">Auto-apply running</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 240 }} noWrap>
            {active.query}
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="contained"
          color="warning"
          startIcon={<Stop fontSize="sm" />}
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
        >
          Stop
        </Button>
      </Stack>
    </Paper>
  );
}
