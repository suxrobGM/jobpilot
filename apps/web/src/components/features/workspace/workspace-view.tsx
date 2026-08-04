"use client";

import type { ReactElement } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Box, Tab, Tabs } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { queryKeys } from "@/api/query-keys";
import { useSearchParamWriter } from "@/hooks/use-search-param-writer";
import { useSseChannel } from "@/lib/sse/client";
import { ApplicationsPanel } from "./applications/applications-panel";
import { OverviewPanel } from "./overview-panel";

const TABS = ["overview", "applications"] as const;
type WorkspaceTab = (typeof TABS)[number];

/**
 * Two-tab workspace. Owns the single SSE subscription for the page, invalidating
 * the campaigns and applications queries so every panel stays live from one
 * connection.
 */
export function WorkspaceView(): ReactElement {
  const queryClient = useQueryClient();
  const tabParam = useSearchParams().get("tab");
  const write = useSearchParamWriter();
  const tab: WorkspaceTab = TABS.includes(tabParam as WorkspaceTab)
    ? (tabParam as WorkspaceTab)
    : "overview";

  useSseChannel(workspaceChannel, null, {
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Tabs
        value={tab}
        onChange={(_, value: WorkspaceTab) => write({ tab: value === "overview" ? null : value })}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="overview" label="Overview" />
        <Tab value="applications" label="Applications" />
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBlock: 2 }}>
        {tab === "overview" ? <OverviewPanel /> : <ApplicationsPanel />}
      </Box>
    </Box>
  );
}
