"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { applicationQueries, feedQueries } from "@/api/queries";
import type { ApplicationDto } from "@/api/types";
import { ListHeader, ListLead, ListRow, PagedList } from "@/components/ui/data";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { initials } from "@/utils/format";
import { applicationHref } from "@/utils/routes";
import { useFunnelStatus, usePipelineFilters } from "../pipeline-filters";

export function AppliedView(): ReactElement {
  const filters = usePipelineFilters();
  const status = useFunnelStatus();
  const pagination = usePaginationParams();
  const apps = useQuery(
    applicationQueries.list({ ...pagination.query, ...filters, ...(status && { status }) }),
  );
  const feedNames = new Map((useQuery(feedQueries.list()).data ?? []).map((f) => [f.id, f.name]));
  const rows = apps.data?.items ?? [];
  const source = (app: ApplicationDto): string =>
    app.feedId ? (feedNames.get(app.feedId) ?? app.source) : "Single apply";

  return (
    <PagedList
      query={apps}
      pager={pagination}
      isEmpty={rows.length === 0}
      errorTitle="Couldn't load your applications."
      empty={<EmptyState variant="inline" title="No applications match the filters." />}
      header={<ListHeader>Recently applied</ListHeader>}
    >
      {rows.map((app) => (
        <ListRow
          key={app.id}
          href={applicationHref(app.id)}
          lead={<ListLead>{initials(app.company)}</ListLead>}
          title={app.title}
          meta={`${app.company} · via ${source(app)}`}
          status={<StatusChip domain="application" value={app.status} />}
          time={<RelativeTime value={app.appliedAt} />}
        />
      ))}
    </PagedList>
  );
}
