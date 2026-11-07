"use client";

import type { ReactNode } from "react";
import { PAGE_SIZE_OPTIONS, type Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { MenuItem, Pagination, Select, Stack, Typography } from "@mui/material";

interface PaginationFooterProps {
  /** The `pagination` block of a paginated API response. */
  pagination: PageMeta;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page selector (e.g. a fixed-size widget). */
  onPageSizeChange?: (pageSize: number) => void;
}

/** "1–25 of 303 · 25 per page" and the pager; the summary shows even on a single page. */
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
      sx={{ minHeight: 32, alignItems: "center", justifyContent: "space-between" }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="captionMuted" noWrap>
          {`${first}–${last} of ${total}`}
        </Typography>
        {onPageSizeChange && (
          <Select
            variant="standard"
            disableUnderline
            value={limit}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            renderValue={(size) => `${size} per page`}
            inputProps={{ "aria-label": "Rows per page" }}
            sx={{
              typography: "caption",
              color: "text.secondary",
              display: { xs: "none", sm: "inline-flex" },
            }}
          >
            {sizes.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>
      {totalPages > 1 && (
        <Pagination
          size="small"
          count={totalPages}
          page={page}
          siblingCount={0}
          onChange={(_, next) => onPageChange(next)}
        />
      )}
    </Stack>
  );
}
