"use client";

import type { ReactElement } from "react";
import type { ApplicationStatus } from "@jobpilot/contracts/application";
import type { PipelineFilters } from "@jobpilot/contracts/pipeline";
import { useQuery } from "@tanstack/react-query";
import { applicationQueries, feedQueries } from "@/api/queries";
import type { ApplicationDto } from "@/api/types";
import { ListCard, ListHeader, ListLead, ListRow, PaginationFooter } from "@/components/ui/data";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import type { PaginationParams } from "@/hooks/use-pagination";
import { initials } from "@/utils/format";
import { applicationHref } from "@/utils/routes";

interface AppliedViewProps {
  filters: PipelineFilters;
  status: ApplicationStatus | null;
  pagination: PaginationParams;
}

export function AppliedView(props: AppliedViewProps): ReactElement {
  const { filters, status, pagination } = props;
  const apps = useQuery(
    applicationQueries.list({ ...pagination.query, ...filters, ...(status && { status }) }),
  );
  const feeds = useQuery(feedQueries.list()).data ?? [];
  const rows = apps.data?.items ?? [];
  const source = (app: ApplicationDto): string =>
    app.feedId
      ? (feeds.find((feed) => feed.id === app.feedId)?.name ?? app.source)
      : "Single apply";

  return (
    <QuerySection
      query={apps}
      errorTitle="Couldn't load your applications."
      isEmpty={rows.length === 0}
      empty={<EmptyState variant="inline" title="No applications match the filters." />}
    >
      <ListCard
        header={<ListHeader>Recently applied</ListHeader>}
        footer={
          apps.data && (
            <PaginationFooter
              pagination={apps.data.pagination}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )
        }
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
      </ListCard>
    </QuerySection>
  );
}
