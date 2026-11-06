"use client";

import { type ReactElement, useState } from "react";
import type { PipelineFilters } from "@jobpilot/contracts/pipeline";
import { AddLink } from "@mui/icons-material";
import { Button, Stack, Tab, Tabs } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { applicationQueries, feedQueries, jobBoardQueries, pipelineQueries } from "@/api/queries";
import { FilterBar, SearchField, SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import { enumParam } from "@/utils/search-params";
import { AddLinksDialog } from "./add-links-dialog";
import { AppliedView } from "./applied/applied-view";
import { JobsView } from "./jobs/jobs-view";
import { PIPELINE_TAB_KEYS, PIPELINE_TABS, type PipelineTab } from "./pipeline-tabs";

/** Every job the pilot touched, across searches and feeds, one tab per stage. */
export function PipelineView(): ReactElement {
  const params = useSearchParams();
  const view: PipelineTab = enumParam(PIPELINE_TAB_KEYS, params.get("view")) ?? "found";
  const feedId = params.get("feed");
  const board = params.get("board");
  const pagination = usePaginationParams();
  const search = useUrlSearch("q", pagination);
  const [addingLinks, setAddingLinks] = useState(false);

  const filters: PipelineFilters = {
    ...(feedId && { feedId }),
    ...(board && { board }),
    ...(search.applied && { search: search.applied }),
  };
  const counts = useQuery(pipelineQueries.counts(filters)).data;
  const applied = useQuery(applicationQueries.summary(filters)).data?.total;
  const feeds = useQuery(feedQueries.list()).data ?? [];
  const boards = useQuery(jobBoardQueries.list()).data ?? [];

  const jobFeeds = feeds.filter((feed) => feed.kind !== "networking");
  const feedLabel = new Map(jobFeeds.map((feed) => [feed.id, feed.name]));
  const feedOptions: SelectFieldOption[] = jobFeeds.map((feed) => ({
    value: feed.id,
    label: feed.name,
  }));
  const boardOptions: SelectFieldOption[] = boards.map((b) => ({ value: b.name, label: b.name }));
  const tabCount = (key: PipelineTab) => (key === "applied" ? applied : counts?.[key]);

  const hasFilters = feedId !== null || board !== null || search.applied !== "";
  const clear = (): void => {
    search.setDraft("");
    pagination.setFilters({ q: null, board: null, feed: null, group: null });
  };

  return (
    <Stack spacing={2}>
      <Tabs
        value={view}
        variant="scrollable"
        allowScrollButtonsMobile
        onChange={(_, next: PipelineTab) =>
          pagination.setFilters({ view: next === "found" ? null : next, group: null })
        }
      >
        {PIPELINE_TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <Tab
              key={tab.key}
              value={tab.key}
              label={count === undefined ? tab.label : `${tab.label} · ${count}`}
            />
          );
        })}
      </Tabs>
      <SectionCard>
        <Stack spacing={2}>
          <FilterBar
            hasFilters={hasFilters}
            onClear={clear}
            end={
              <Button
                variant="outlined"
                startIcon={<AddLink fontSize="sm" />}
                onClick={() => setAddingLinks(true)}
              >
                Add job links
              </Button>
            }
          >
            <SearchField
              placeholder="Search role, company, URL"
              value={search.draft}
              onChange={search.setDraft}
            />
            <SelectField
              label="Feed"
              value={feedId}
              emptyLabel="All feeds"
              options={feedOptions}
              onChange={(next) => pagination.setFilters({ feed: next })}
            />
            <SelectField
              label="Board"
              value={board}
              emptyLabel="All boards"
              options={boardOptions}
              onChange={(next) => pagination.setFilters({ board: next })}
            />
          </FilterBar>
          {view === "applied" ? (
            <AppliedView filters={filters} feedLabel={feedLabel} pagination={pagination} />
          ) : (
            <JobsView key={view} view={view} filters={filters} pagination={pagination} />
          )}
        </Stack>
      </SectionCard>
      <AddLinksDialog open={addingLinks} onClose={() => setAddingLinks(false)} />
    </Stack>
  );
}
