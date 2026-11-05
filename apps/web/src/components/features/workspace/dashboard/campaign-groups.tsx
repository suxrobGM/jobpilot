"use client";

import type { ReactElement, ReactNode } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import type { Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { Add } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { campaignQueries } from "@/api/queries";
import type { CampaignDto } from "@/api/types";
import { CampaignRow } from "@/components/features/campaigns";
import { PaginationFooter } from "@/components/ui/data";
import { EmptyState, QuerySection, type QueryState } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";

/** Each group is its own server-filtered page, so neither can hide behind the other's rows. */
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
  const query: QueryState = {
    isLoading: summary.isLoading || groups.some((group) => group.isLoading),
    isError: summary.isError || groups.some((group) => group.isError),
    refetch: () => {
      void summary.refetch();
      for (const group of groups) {
        group.refetch();
      }
    },
  };
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
        query={query}
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
          {groups.every((group) => !group.pagination?.total) && (
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
  group: CampaignGroupState;
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
      {group.items.map((campaign) => (
        <CampaignRow key={campaign.id} campaign={campaign} />
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
interface CampaignGroupState {
  label: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  items: CampaignDto[];
  pagination: PageMeta | undefined;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

function useCampaignGroup(group: (typeof GROUPS)[number]): CampaignGroupState {
  const { query, setPage, setPageSize } = usePaginationParams({
    pageSize: PAGE_SIZE,
    prefix: group.key,
  });
  const result = useQuery(campaignQueries.list({ ...query, status: [...group.statuses] }));

  return {
    label: group.label,
    isLoading: result.isLoading,
    isError: result.isError,
    refetch: () => void result.refetch(),
    items: result.data?.items ?? [],
    pagination: result.data?.pagination,
    setPage,
    setPageSize,
  };
}
