"use client";

import type { ReactElement } from "react";
import { Pagination, Stack, Typography } from "@mui/material";

interface PaginationFooterProps {
  /** Current page (1-based). */
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/**
 * "Showing X–Y of Z" summary plus a page selector. Renders nothing when the
 * list fits on a single page. Designed to consume a {@link usePagination} result.
 */
export function PaginationFooter(props: PaginationFooterProps): ReactElement {
  const { page, pageCount, pageSize, total, onChange } = props;

  if (total <= pageSize) {
    return <></>;
  }

  return (
    <Stack direction="row" sx={{ mt: 2, alignItems: "center", justifyContent: "space-between" }}>
      <Typography variant="captionMuted">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </Typography>
      <Pagination size="small" count={pageCount} page={page} onChange={(_, p) => onChange(p)} />
    </Stack>
  );
}
