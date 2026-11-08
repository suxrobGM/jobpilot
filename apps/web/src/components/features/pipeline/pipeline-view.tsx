"use client";

import { type ReactElement, useState } from "react";
import { AddLink } from "@mui/icons-material";
import { Button, LinearProgress, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { applicationQueries, jobBoardQueries, pipelineQueries } from "@/api/queries";
import { CountLabel, statusLabel } from "@/components/ui/display";
import { FilterBar, FilterToggle, SearchField, SelectField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import { plural } from "@/utils/format";
import { enumParam } from "@/utils/search-params";
import { AddLinksDialog } from "./add-links-dialog";
import { AppliedView } from "./applied/applied-view";
import { FeedSelect } from "./feed-select";
import { JobsView } from "./jobs/jobs-view";
import { NeedsYouBanner } from "./needs-you-banner";
import { FUNNEL, useFunnelStatus, usePipelineFilters } from "./pipeline-filters";
import { PIPELINE_TAB_KEYS, PIPELINE_TABS, type PipelineTab } from "./pipeline-tabs";

/** Every job the pilot touched, across searches and feeds, one tab per stage. */
export function PipelineView(): ReactElement {
  const params = useSearchParams();
  const chosenView = enumParam(PIPELINE_TAB_KEYS, params.get("view"));

  const feedId = params.get("feed");
  const board = params.get("board");
  const status = useFunnelStatus();
  const pagination = usePaginationParams();
  const search = useUrlSearch("q", pagination);

  const [addingLinks, setAddingLinks] = useState(false);
  const filters = usePipelineFilters();

  const countsQuery = useQuery(pipelineQueries.counts(filters));
  const counts = countsQuery.data;
  const summaryQuery = useQuery(applicationQueries.summary(filters));
  const summary = summaryQuery.data;
  const boards = useQuery(jobBoardQueries.list()).data ?? [];

  const boardOptions = boards.map((b) => ({ value: b.name, label: b.name }));
  const statusOptions = FUNNEL.map((key) => ({
    value: key,
    label: statusLabel("application", key),
    count: summary?.byStatus[key] ?? 0,
  }));
  const tabCount = (key: PipelineTab) => (key === "applied" ? summary?.total : counts?.views[key]);
  // A URL that names no tab opens where the jobs are, not on an empty To review.
  const landing = PIPELINE_TAB_KEYS.find((key) => (tabCount(key) ?? 0) > 0);
  const view = chosenView ?? landing ?? "review";
  // Mounting a tab before the counts pick one fetches it, then remounts another.
  const picking = chosenView === null && (countsQuery.isPending || summaryQuery.isPending);
  // Applications aren't counted per feed, so Applied lists every feed without numbers.
  const feedCounts =
    view !== "applied" && counts
      ? new Map(counts.feeds.map((feed) => [feed.feedId, feed.views[view]]))
      : null;
  const shown = tabCount(view);
  const noun = view === "applied" ? "application" : "job";
  const hasFilters = Object.keys(filters).length > 0 || status !== null;

  const clear = (): void => {
    search.setDraft("");
    pagination.setFilters({ q: null, board: null, feed: null, status: null });
  };

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Pipeline"
        actions={
          <Button
            variant="outlined"
            startIcon={<AddLink fontSize="sm" />}
            onClick={() => setAddingLinks(true)}
          >
            Add job links
          </Button>
        }
        tabs={
          <Tabs
            value={view}
            variant="scrollable"
            onChange={(_, next: PipelineTab) => pagination.setFilters({ view: next, status: null })}
          >
            {PIPELINE_TABS.map((tab) => (
              <Tab
                key={tab.key}
                value={tab.key}
                label={<CountLabel label={tab.label} count={tabCount(tab.key)} />}
              />
            ))}
          </Tabs>
        }
      />
      <NeedsYouBanner />
      <FilterBar
        hasFilters={hasFilters}
        onClear={clear}
        end={
          shown !== undefined && (
            <Typography variant="captionMuted" sx={{ display: { xs: "none", md: "block" } }}>
              {plural(shown, noun)}
            </Typography>
          )
        }
      >
        <SearchField
          placeholder="Search role, company, URL"
          value={search.draft}
          onChange={search.setDraft}
        />
        <FeedSelect
          value={feedId}
          counts={feedCounts}
          total={shown ?? null}
          onChange={(next) => pagination.setFilters({ feed: next })}
        />
        <SelectField
          label="Board"
          value={board}
          options={boardOptions}
          onChange={(next) => pagination.setFilters({ board: next })}
        />
        {view === "applied" && (
          <FilterToggle
            label="Status"
            value={status}
            options={statusOptions}
            allCount={summary?.total}
            onChange={(next) => pagination.setFilters({ status: next })}
          />
        )}
      </FilterBar>
      {picking && <LinearProgress />}
      {!picking && view === "applied" && <AppliedView />}
      {!picking && view !== "applied" && <JobsView key={view} view={view} />}
      <AddLinksDialog open={addingLinks} onClose={() => setAddingLinks(false)} />
    </Stack>
  );
}
