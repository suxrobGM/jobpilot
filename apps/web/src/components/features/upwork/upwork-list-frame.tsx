"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import { PagedList } from "@/components/ui/data";
import { FilterBar } from "@/components/ui/form";
import type { PaginationParams } from "@/hooks/use-pagination";

export const UPWORK_PAGE_SIZE = 10;

interface UpworkListFrameProps {
  filters: ReactNode;
  hasFilters: boolean;
  onClearFilters: () => void;
  /** e.g. "12 proposals", at the toolbar's right end. */
  countLabel: string;
  actions?: ReactNode;
  query: ComponentProps<typeof PagedList>["query"];
  pager: PaginationParams;
  errorTitle: string;
  empty: ReactNode;
  /** The `ListRow`s of the current page; an empty array shows `empty`. */
  children: ReactNode[];
}

/** Toolbar, a page of rows and the pager - the shape of every Upwork list. */
export function UpworkListFrame(props: UpworkListFrameProps): ReactElement {
  const {
    filters,
    hasFilters,
    onClearFilters,
    countLabel,
    actions,
    query,
    pager,
    errorTitle,
    empty,
    children,
  } = props;

  return (
    <Stack spacing={2}>
      <FilterBar
        hasFilters={hasFilters}
        onClear={onClearFilters}
        end={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="captionMuted">{countLabel}</Typography>
            {actions}
          </Stack>
        }
      >
        {filters}
      </FilterBar>

      <PagedList
        query={query}
        pager={pager}
        errorTitle={errorTitle}
        isEmpty={children.length === 0}
        empty={empty}
      >
        {children}
      </PagedList>
    </Stack>
  );
}
