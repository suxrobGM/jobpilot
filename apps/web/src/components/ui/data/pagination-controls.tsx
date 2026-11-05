"use client";

import type { ReactNode } from "react";
import type { Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { usePaginationParams } from "@/hooks/use-pagination";
import { PaginationFooter } from "./pagination-footer";

interface PaginationControlsProps {
  /** The `pagination` block of a paginated API response. */
  pagination: PageMeta;
}

/** The pager for a server-rendered page, whose fetch only re-runs on a real navigation. */
export function PaginationControls(props: PaginationControlsProps): ReactNode {
  const { pagination } = props;
  const { setPage, setPageSize } = usePaginationParams({ navigate: true });

  return (
    <PaginationFooter
      pagination={pagination}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  );
}
