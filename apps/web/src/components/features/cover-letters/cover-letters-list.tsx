"use client";

import type { ReactElement } from "react";
import { Launch } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { coverLetterQueries } from "@/api/queries";
import { TooltipIconButton } from "@/components/ui/buttons";
import { ListHeader, ListLead, ListRow, PagedList } from "@/components/ui/data";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { initials } from "@/utils/format";
import { coverLetterHref } from "@/utils/routes";

export function CoverLettersList(): ReactElement {
  const pagination = usePaginationParams();
  const letters = useQuery(coverLetterQueries.list(pagination.query));
  const rows = letters.data?.items ?? [];

  return (
    <PagedList
      query={letters}
      pager={pagination}
      isEmpty={rows.length === 0}
      errorTitle="Couldn't load your cover letters."
      empty={
        <EmptyState
          variant="inline"
          title="No cover letters yet."
          description="The pilot writes one whenever an application asks for it."
        />
      }
      header={<ListHeader>Written during applications, newest first</ListHeader>}
    >
      {rows.map((letter) => (
        <ListRow
          key={letter.id}
          href={coverLetterHref(letter.id)}
          lead={<ListLead>{initials(letter.company ?? "?")}</ListLead>}
          title={letter.jobTitle ?? "Untitled role"}
          meta={letter.company ?? "Unknown company"}
          actions={
            letter.jobUrl && (
              <TooltipIconButton title="Open the job posting" href={letter.jobUrl} size="small">
                <Launch fontSize="sm" />
              </TooltipIconButton>
            )
          }
          status={<StatusChip domain="source" value={letter.source} />}
          time={<RelativeTime value={letter.createdAt} />}
        />
      ))}
    </PagedList>
  );
}
