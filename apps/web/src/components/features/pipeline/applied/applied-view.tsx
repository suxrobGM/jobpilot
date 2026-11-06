"use client";

import type { ReactElement } from "react";
import type { PipelineFilters } from "@jobpilot/contracts/pipeline";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { applicationQueries } from "@/api/queries";
import { PaginationFooter } from "@/components/ui/data";
import { QuerySection } from "@/components/ui/feedback";
import type { PaginationParams } from "@/hooks/use-pagination";
import { enumParam } from "@/utils/search-params";
import { ApplicationsTable } from "./applications-table";
import { FUNNEL_GROUPS, FunnelBar, type FunnelKey } from "./funnel-bar";

const FUNNEL_KEYS = FUNNEL_GROUPS.map((group) => group.key);

interface AppliedViewProps {
  filters: PipelineFilters;
  /** Maps a feedId to its name, for attribution. */
  feedLabel: Map<string, string>;
  pagination: PaginationParams;
}

/** Applications with the outcome strip: applied → screening → interviewing → offer. */
export function AppliedView(props: AppliedViewProps): ReactElement {
  const { filters, feedLabel, pagination } = props;
  const group = enumParam<FunnelKey>(FUNNEL_KEYS, useSearchParams().get("group"));

  const apps = useQuery(
    applicationQueries.list({ ...pagination.query, ...filters, ...(group && { status: group }) }),
  );
  // Status is left out so every tile keeps its size while one is picked.
  const summary = useQuery(applicationQueries.summary(filters));
  const count = (key: FunnelKey) => summary.data?.byStatus[key] ?? 0;
  const counts: Record<FunnelKey, number> = {
    applied: count("applied"),
    screening: count("screening"),
    interviewing: count("interviewing"),
    offer: count("offer"),
  };

  return (
    <Stack spacing={2}>
      <FunnelBar
        counts={counts}
        selected={group}
        onSelect={(next) => pagination.setFilters({ group: next })}
      />
      <QuerySection
        query={apps}
        errorTitle="Couldn't load your applications."
        isEmpty={false}
        empty={null}
      >
        <ApplicationsTable rows={apps.data?.items ?? []} feedLabel={feedLabel} />
      </QuerySection>
      {apps.data && (
        <PaginationFooter
          pagination={apps.data.pagination}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </Stack>
  );
}
