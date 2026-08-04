"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { AttentionStrip } from "./dashboard/attention-strip";
import { CampaignGroups } from "./dashboard/campaign-groups";
import { NowRunning } from "./dashboard/now-running";
import { PilotStatusCard } from "./dashboard/pilot-card";
import { ProfileChecklistCard } from "./dashboard/profile-checklist-card";
import { StatTiles } from "./dashboard/stat-tiles";

/** Overview tab - activity-first: what's running, what needs me, campaigns. */
export function OverviewPanel(): ReactElement {
  return (
    <Stack spacing={2}>
      <ProfileChecklistCard />
      <PilotStatusCard />
      <NowRunning />
      <AttentionStrip />
      <StatTiles />
      <CampaignGroups />
    </Stack>
  );
}
