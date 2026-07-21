"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import type { CampaignSource, CampaignStatus } from "@jobpilot/contracts/campaign";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Stop } from "@mui/icons-material";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { invalidations, queryKeys } from "@/api/query-keys";
import { DOCK_COLLAPSED, DOCK_EXPANDED } from "@/components/layout/shell-config";
import { readAgentStorage, subscribeAgentStorage } from "@/lib/agent-storage";
import { useSseChannel } from "@/lib/sse/client";

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
  useSseChannel(workspaceChannel, null, {
    on: {
      "campaign.updated": invalidateCampaigns,
      "campaign.completed": invalidateCampaigns,
    },
  });

  const campaigns = useApiQuery(campaignQueries.list(FILTERS));

  const active = campaigns.data?.items[0] ?? null;

  const stop = useApiMutation<{ campaignId: string; status: string }, void>(
    () => {
      if (!active) {
        throw new Error("No active auto-apply campaign");
      }
      return api.campaigns({ id: active.campaignId }).status.post({
        status: "paused" satisfies CampaignStatus,
        actor: "user",
      });
    },
    {
      successMessage: "Auto-apply paused",
      invalidate: invalidations.campaign,
    },
  );

  if (!active) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      sx={(t) => ({
        display: { xs: "none", md: "flex" },
        position: "fixed",
        bottom: 16,
        right: rightOffset,
        zIndex: t.zIndex.snackbar,
        borderRadius: t.radii.md,
        padding: 1.5,
        backgroundColor: "background.paper",
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
