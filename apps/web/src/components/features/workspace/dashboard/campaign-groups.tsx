"use client";

import type { ReactElement, ReactNode } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { Add } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { campaignQueries } from "@/api/queries";
import { CampaignRow } from "@/components/features/campaigns";
import { PaginationFooter } from "@/components/ui/data";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";

/**
 * Each group is its own server-filtered page, so neither can hide behind the other's rows.
 * Running campaigns live in Now running, so they are left out here.
 */
const GROUPS = [
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "completed", label: "Completed", statuses: ["completed", "failed"] },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: CampaignStatus[] }>;

const PAGE_SIZE = 10;

export function CampaignGroups(): ReactElement {
  const { expand } = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const groups = [useCampaignGroup(GROUPS[0]), useCampaignGroup(GROUPS[1])];
  // Running campaigns render in Now running, so emptiness is judged on the whole account.
  const summary = useQuery(campaignQueries.summary());
  const loading = summary.isLoading || groups.some((g) => g.isLoading);
  const isError = summary.isError || groups.some((g) => g.isError);
  const isEmpty = summary.data?.total === 0;

  return (
    <SectionCard
      title="Campaigns"
      description="A search the agent runs for you. It scores each job it finds against your resume. In auto-apply mode it applies to every job that scores above your cutoff."
      actions={
        agentAvailable && (
          <Button
            size="small"
            variant="contained"
            startIcon={<Add fontSize="md" />}
            href="/campaigns/new"
          >
            New campaign
          </Button>
        )
      }
    >
      <QuerySection
        isLoading={loading}
        isError={isError}
        onRetry={() => {
          void summary.refetch();
          for (const group of groups) {
            void group.refetch();
          }
        }}
        errorTitle="Couldn't load your campaigns."
        isEmpty={isEmpty}
        empty={
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
        }
      >
        <Stack spacing={2}>
          {groups.every((g) => !g.pagination?.total) && (
            <Typography variant="body2Muted">
              Paused and finished campaigns show up here.
            </Typography>
          )}
          {groups.map((group) => (
            <CampaignGroupSection key={group.label} group={group} />
          ))}
        </Stack>
      </QuerySection>
    </SectionCard>
  );
}

interface CampaignGroupSectionProps {
  group: ReturnType<typeof useCampaignGroup>;
}

function CampaignGroupSection(props: CampaignGroupSectionProps): ReactNode {
  const { group } = props;
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
        <CampaignRow key={c.id} campaign={c} />
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

/** One paginated status group, with its own `?pausedPage=` / `?completedPage=` params. */
function useCampaignGroup(group: (typeof GROUPS)[number]) {
  const { query, setPage, setPageSize } = usePaginationParams({
    pageSize: PAGE_SIZE,
    prefix: group.key,
  });
  const result = useQuery(campaignQueries.list({ ...query, status: [...group.statuses] }));

  return {
    label: group.label,
    isLoading: result.isLoading,
    isError: result.isError,
    refetch: result.refetch,
    items: result.data?.items ?? [],
    pagination: result.data?.pagination,
    setPage,
    setPageSize,
  };
}
