"use client";

import { type ReactElement, useState } from "react";
import { AddLink } from "@mui/icons-material";
import { Button, LinearProgress, Stack, Tab, Tabs, Typography } from "@mui/material";
import { CountLabel } from "@/components/ui/display";
import { FilterBar, SearchField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import { plural } from "@/utils/format";
import { AddLinksDialog } from "./add-links-dialog";
import { AppliedView } from "./applied/applied-view";
import { StatusFilter } from "./applied/status-filter";
import { BoardSelect } from "./board-select";
import { FeedSelect } from "./feed-select";
import { JobsView } from "./jobs/jobs-view";
import { NeedsYouBanner } from "./needs-you-banner";
import { useFunnelStatus, usePipelineFilters } from "./pipeline-filters";
import { PIPELINE_TABS, type PipelineTab, usePipelineTab } from "./pipeline-tabs";

/** Every job the pilot touched, across searches and feeds, one tab per stage. */
export function PipelineView(): ReactElement {
  const tab = usePipelineTab();
  const pagination = usePaginationParams();
  const search = useUrlSearch("q", pagination);
  const filters = usePipelineFilters();
  const status = useFunnelStatus();
  const hasFilters = Object.keys(filters).length > 0 || status !== null;
  const [addingLinks, setAddingLinks] = useState(false);
  const shown = tab.count(tab.view);

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
            value={tab.view}
            variant="scrollable"
            onChange={(_, next: PipelineTab) => pagination.setFilters({ view: next, status: null })}
          >
            {PIPELINE_TABS.map(({ key, label }) => (
              <Tab
                key={key}
                value={key}
                label={<CountLabel label={label} count={tab.count(key)} />}
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
          shown !== null && (
            <Typography variant="captionMuted" sx={{ display: { xs: "none", md: "block" } }}>
              {plural(shown, tab.view === "applied" ? "application" : "job")}
            </Typography>
          )
        }
      >
        <SearchField
          placeholder="Search role, company, URL"
          value={search.draft}
          onChange={search.setDraft}
        />
        <FeedSelect />
        <BoardSelect />
        {tab.view === "applied" && <StatusFilter />}
      </FilterBar>
      {tab.picking && <LinearProgress />}
      {!tab.picking && tab.view === "applied" && <AppliedView />}
      {!tab.picking && tab.view !== "applied" && <JobsView key={tab.view} view={tab.view} />}
      <AddLinksDialog open={addingLinks} onClose={() => setAddingLinks(false)} />
    </Stack>
  );
}
