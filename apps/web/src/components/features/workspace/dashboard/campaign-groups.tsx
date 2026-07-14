"use client";

import type { ReactElement } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { Add } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { CampaignRow } from "@/components/features/campaigns";
import { EmptyState } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";

const GROUPS: ReadonlyArray<{ label: string; statuses: CampaignStatus[] }> = [
  { label: "Active", statuses: ["in_progress", "paused"] },
  { label: "Needs attention", statuses: ["interrupted"] },
  { label: "Completed", statuses: ["completed", "failed"] },
];

export function CampaignGroups(): ReactElement {
  const router = useRouter();
  const { expand } = useAgentDock();
  const agentAvailable = useAgentAvailable();
  const campaigns = useApiQuery(campaignQueries.list());
  const rows = campaigns.data ?? [];

  const open = (c: CampaignDto): void => {
    router.push(`/campaigns/${encodeURIComponent(c.campaignId)}` as Route);
  };

  return (
    <SectionCard
      title="Campaigns"
      actions={
        agentAvailable && (
          <Button
            size="small"
            variant="contained"
            startIcon={<Add fontSize="md" />}
            onClick={() => router.push("/campaigns/new")}
          >
            New campaign
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No campaigns yet"
          description={
            agentAvailable
              ? "Start the JobPilot agent in the dock and run a search - or create a campaign manually."
              : "Open JobPilot on your desktop to start the agent and run a search."
          }
          action={
            agentAvailable ? (
              <Button size="small" variant="outlined" onClick={expand}>
                Open agent dock
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack spacing={2}>
          {GROUPS.map((group) => {
            const items = rows.filter((c) => group.statuses.includes(c.status));
            if (items.length === 0) {
              return null;
            }
            return (
              <Stack key={group.label} spacing={1}>
                <Typography variant="overlineMuted">
                  {group.label} · {items.length}
                </Typography>
                {items.map((c) => (
                  <CampaignRow
                    key={c.campaignId}
                    campaign={c}
                    onSelect={open}
                    onOpenDetail={open}
                  />
                ))}
              </Stack>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}
