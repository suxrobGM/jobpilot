"use client";

import type { ReactElement, ReactNode } from "react";
import type { Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { QuerySection, type QueryState } from "@/components/ui/feedback";
import type { PaginationParams } from "@/hooks/use-pagination";
import { ListCard } from "./list-card";
import { PaginationFooter } from "./pagination-footer";

interface PagedQuery extends QueryState {
  data: { pagination: PageMeta } | undefined;
}

interface PagedListProps {
  query: PagedQuery;
  pager: PaginationParams;
  errorTitle: string;
  isEmpty: boolean;
  empty: ReactNode;
  header?: ReactNode;
  children: ReactNode;
}

export function PagedList(props: PagedListProps): ReactElement {
  const { query, pager, errorTitle, isEmpty, empty, header, children } = props;
  const pagination = query.data?.pagination;

  return (
    <QuerySection query={query} errorTitle={errorTitle} isEmpty={isEmpty} empty={empty}>
      <ListCard
        header={header}
        footer={
          pagination && (
            <PaginationFooter
              pagination={pagination}
              onPageChange={pager.setPage}
              onPageSizeChange={pager.setPageSize}
            />
          )
        }
      >
        {children}
      </ListCard>
    </QuerySection>
  );
}
