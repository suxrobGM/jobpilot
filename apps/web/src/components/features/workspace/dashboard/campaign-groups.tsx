"use client";

import type { ReactElement, ReactNode } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { Add } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { CampaignRow } from "@/components/features/campaigns";
import { RunJobAlertsButton } from "@/components/features/pilot";
import { EmptyState, PaginationFooter } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";

/** Each group is its own server-filtered page, so neither can hide behind the other's rows. */
const GROUPS = [
  { key: "active", label: "Active", statuses: ["in_progress", "paused"] },
  { key: "completed", label: "Completed", statuses: ["completed", "failed"] },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: CampaignStatus[] }>;

const PAGE_SIZE = 10;

export function CampaignGroups(): ReactElement {
  const router = useRouter();
  const { expand } = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const groups = [useCampaignGroup(GROUPS[0]), useCampaignGroup(GROUPS[1])];
  const isEmpty = groups.every((g) => !g.pagination?.total);

  const open = (c: CampaignDto): void => {
    router.push(`/campaigns/${encodeURIComponent(c.campaignId)}` as Route);
  };

  return (
    <SectionCard
      title="Campaigns"
      description="A search the agent runs for you. It scores each job it finds against your resume. In auto-apply mode it applies to every job that scores above your cutoff."
      actions={
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <RunJobAlertsButton label="Run job alert" variant="outlined" />
          {agentAvailable && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Add fontSize="md" />}
              onClick={() => router.push("/campaigns/new")}
            >
              New campaign
            </Button>
          )}
        </Stack>
      }
    >
      {isEmpty ? (
        <EmptyState
          variant="inline"
          title="No campaigns yet"
          description={
            agentAvailable
              ? "Start a campaign, describe the job you want, and pick a board. Choose Search mode if you want to see the matches before anything is sent."
              : "Open JobPilot on your desktop to start the agent and run your first search."
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
          {groups.map((group) => (
            <CampaignGroupSection key={group.label} group={group} onOpen={open} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

interface CampaignGroupSectionProps {
  group: ReturnType<typeof useCampaignGroup>;
  onOpen: (campaign: CampaignDto) => void;
}

function CampaignGroupSection(props: CampaignGroupSectionProps): ReactNode {
  const { group, onOpen } = props;
  const { pagination } = group;

  if (!pagination?.total) {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="overlineMuted">
        {group.label} · {pagination.total}
      </Typography>
      {group.items.map((c) => (
        <CampaignRow key={c.campaignId} campaign={c} onSelect={onOpen} onOpenDetail={onOpen} />
      ))}
      {/* The group heading already carries the total, so a one-page footer is noise. */}
      {pagination.totalPages > 1 && (
        <PaginationFooter
          pagination={pagination}
          onPageChange={group.setPage}
          onPageSizeChange={group.setPageSize}
        />
      )}
    </Stack>
  );
}

/** One paginated status group, with its own `?activePage=` / `?completedPage=` params. */
function useCampaignGroup(group: (typeof GROUPS)[number]) {
  const { query, setPage, setPageSize } = usePaginationParams({
    pageSize: PAGE_SIZE,
    prefix: group.key,
  });
  const result = useApiQuery(campaignQueries.list({ ...query, status: [...group.statuses] }));

  return {
    label: group.label,
    items: result.data?.items ?? [],
    pagination: result.data?.pagination,
    setPage,
    setPageSize,
  };
}
