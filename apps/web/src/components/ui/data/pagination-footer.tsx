"use client";

import type { ReactNode } from "react";
import { PAGE_SIZE_OPTIONS, type Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { MenuItem, Pagination, Stack, TextField, Typography } from "@mui/material";

interface PaginationFooterProps {
  /** The `pagination` block of a paginated API response. */
  pagination: PageMeta;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page selector (e.g. a fixed-size widget). */
  onPageSizeChange?: (pageSize: number) => void;
}

/** The summary shows even on a single page: the total is still the number a user wants. */
export function PaginationFooter(props: PaginationFooterProps): ReactNode {
  const { pagination, onPageChange, onPageSizeChange } = props;
  const { page, limit, total, totalPages } = pagination;

  if (total === 0) {
    return null;
  }

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  // `?pageSize=` is only capped, so an off-menu size needs an option or MUI renders it blank.
  const sizes = PAGE_SIZE_OPTIONS.includes(limit as (typeof PAGE_SIZE_OPTIONS)[number])
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, limit].sort((a, b) => a - b);

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ mt: 2, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="captionMuted">
          Showing {first}–{last} of {total}
        </Typography>
        {onPageSizeChange && (
          <TextField
            select
            size="small"
            label="Rows"
            value={limit}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            sx={{ minWidth: 96 }}
          >
            {sizes.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
      {totalPages > 1 && (
        <Pagination
          size="small"
          count={totalPages}
          page={page}
          onChange={(_, next) => onPageChange(next)}
        />
      )}
    </Stack>
  );
}
