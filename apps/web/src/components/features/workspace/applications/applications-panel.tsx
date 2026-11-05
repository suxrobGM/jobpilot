"use client";

import type { ReactElement } from "react";
import { SINGLE_APPLY_CAMPAIGN } from "@jobpilot/contracts/application";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { applicationQueries, campaignQueries, jobBoardQueries } from "@/api/queries";
import { PaginationFooter } from "@/components/ui/data";
import { QuerySection } from "@/components/ui/feedback";
import { SearchField, SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import { ApplicationsTable } from "./applications-table";
import { FUNNEL_GROUPS, FunnelBar, type FunnelKey } from "./funnel-bar";

/** Cross-campaign application funnel and a filterable, attributed table. */
export function ApplicationsPanel(): ReactElement {
  const params = useSearchParams();
  const board = params.get("board");
  const campaignId = params.get("campaign");
  const groupParam = params.get("group");
  const group: FunnelKey | null = FUNNEL_GROUPS.some((g) => g.key === groupParam)
    ? (groupParam as FunnelKey)
    : null;

  const pagination = usePaginationParams();
  const { query, setPage, setPageSize, setFilters } = pagination;
  const search = useUrlSearch("q", pagination);
  const term = search.applied;

  // Every filter runs server-side, so a page reflects the whole account rather than itself.
  const filters = {
    ...(board && { board }),
    ...(campaignId && { campaignId }),
    ...(term && { search: term }),
  };

  const apps = useQuery(
    applicationQueries.list({ ...query, ...filters, ...(group && { status: group }) }),
  );

  // Status is deliberately excluded: the tiles keep showing every bucket's size while one is picked.
  const summary = useQuery(applicationQueries.summary(filters));
  const campaigns = useQuery(campaignQueries.list());
  const boards = useQuery(jobBoardQueries.list());

  const rows = apps.data?.items ?? [];
  const campaignLabel = new Map((campaigns.data?.items ?? []).map((c) => [c.id, c.query]));

  const counts = FUNNEL_GROUPS.reduce(
    (acc, g) => {
      acc[g.key] = summary.data?.byStatus[g.key] ?? 0;
      return acc;
    },
    {} as Record<FunnelKey, number>,
  );

  const campaignOptions: SelectFieldOption[] = [
    { value: SINGLE_APPLY_CAMPAIGN, label: "Single applies" },
    ...(campaigns.data?.items ?? []).map((c) => ({ value: c.id, label: c.query })),
  ];
  const boardOptions: SelectFieldOption[] = (boards.data ?? []).map((b) => ({
    value: b.name,
    label: b.name,
  }));

  const isFiltered = term !== "" || board !== null || campaignId !== null || group !== null;

  const clear = (): void => {
    search.setDraft("");
    setFilters({ q: null, board: null, campaign: null, group: null });
  };

  return (
    <Stack spacing={2}>
      <FunnelBar
        counts={counts}
        selected={group}
        onSelect={(next) => setFilters({ group: next })}
      />
      <SectionCard>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            sx={{ alignItems: { md: "center" } }}
          >
            <SearchField
              placeholder="Search role, company, URL"
              value={search.draft}
              onChange={search.setDraft}
            />
            <SelectField
              label="Board"
              value={board}
              emptyLabel="All boards"
              options={boardOptions}
              onChange={(next) => setFilters({ board: next })}
            />
            <SelectField
              label="Campaign"
              value={campaignId}
              emptyLabel="All campaigns"
              options={campaignOptions}
              onChange={(next) => setFilters({ campaign: next })}
            />
            {isFiltered && (
              <Button size="small" variant="text" onClick={clear}>
                Clear
              </Button>
            )}
          </Stack>
          <QuerySection
            isLoading={apps.isPending}
            isError={apps.isError}
            onRetry={() => void apps.refetch()}
            errorTitle="Couldn't load your applications."
            isEmpty={false}
            empty={null}
          >
            <ApplicationsTable rows={rows} campaignLabel={campaignLabel} />
          </QuerySection>
          {apps.data && (
            <PaginationFooter
              pagination={apps.data.pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
