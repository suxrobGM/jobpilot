"use client";

import type { ReactElement, ReactNode } from "react";
import type { Pagination as PageMeta } from "@jobpilot/contracts/pagination";
import { Clear } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { PaginationFooter } from "@/components/ui/data";
import { QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";

export const UPWORK_PAGE_SIZE = 10;

interface UpworkListFrameProps {
  filters: ReactNode;
  hasFilters: boolean;
  onClearFilters: () => void;
  /** e.g. "12 proposals", beside the filters. */
  countLabel: string;
  actions?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  errorTitle: string;
  empty: ReactNode;
  pagination: PageMeta | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** The rows of the current page; an empty array shows `empty`. */
  children: ReactNode[];
}

/** Filter row, count, a page of cards and the pager - the shape of every Upwork list. */
export function UpworkListFrame(props: UpworkListFrameProps): ReactElement {
  const {
    filters,
    hasFilters,
    onClearFilters,
    countLabel,
    actions,
    isLoading,
    isError,
    onRetry,
    errorTitle,
    empty,
    pagination,
    onPageChange,
    onPageSizeChange,
    children,
  } = props;

  return (
    <SectionCard>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
      >
        {filters}
        {hasFilters && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={onClearFilters}
          >
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="captionMuted">{countLabel}</Typography>
        {actions}
      </Stack>

      <QuerySection
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        errorTitle={errorTitle}
        isEmpty={children.length === 0}
        empty={empty}
      >
        <Stack spacing={1}>{children}</Stack>
      </QuerySection>

      {pagination && (
        <PaginationFooter
          pagination={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </SectionCard>
  );
}
