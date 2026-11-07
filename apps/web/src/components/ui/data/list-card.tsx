"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, Checkbox, Stack, Typography } from "@mui/material";

interface ListCardProps {
  header?: ReactNode;
  /** Usually a `PaginationFooter`. */
  footer?: ReactNode;
  children: ReactNode;
}

/** The frame every record list shares: an optional header, `ListRow`s, then the pager. */
export function ListCard(props: ListCardProps): ReactElement {
  const { header, footer, children } = props;
  return (
    <Box
      sx={(theme) => ({
        border: 1,
        borderColor: "line.border",
        borderRadius: theme.radii.lg,
        backgroundColor: theme.palette.surfaces.card,
        overflow: "hidden",
      })}
    >
      {header}
      {children}
      {footer && (
        <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1, borderTop: 1, borderColor: "divider" }}>
          {footer}
        </Box>
      )}
    </Box>
  );
}

interface ListSelection {
  count: number;
  total: number;
  onToggleAll: () => void;
}

interface ListHeaderProps {
  /** Null when the list has no bulk actions, so no select-all box. */
  selection?: ListSelection | null;
  /** Shown once rows are picked, after "N selected". */
  bulkActions?: ReactNode;
  /** The sort hint or a caption. */
  children?: ReactNode;
}

/** Select-all and the sort hint; picking rows turns it into the bulk bar. */
export function ListHeader(props: ListHeaderProps): ReactElement {
  const { selection, bulkActions, children } = props;
  const picked = selection?.count ?? 0;
  const all = picked > 0 && picked === selection?.total;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={(theme) => ({
        alignItems: "center",
        minHeight: 44,
        px: { xs: 1.5, sm: 2 },
        py: 0.5,
        borderBottom: 1,
        borderColor: "divider",
        ...(picked > 0 && { backgroundColor: theme.palette.surfaces.elevated }),
      })}
    >
      {selection && (
        <Checkbox
          size="small"
          checked={all}
          indeterminate={picked > 0 && !all}
          onChange={selection.onToggleAll}
          slotProps={{ input: { "aria-label": "Select all on this page" } }}
          sx={{ p: 0, display: { xs: "none", sm: "inline-flex" } }}
        />
      )}
      {picked > 0 ? (
        <>
          <Typography variant="body2Strong">{`${picked} selected`}</Typography>
          <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: "center" }}>
            {bulkActions}
          </Stack>
        </>
      ) : (
        <Box sx={{ flex: 1, minWidth: 0, typography: "captionMuted" }}>{children}</Box>
      )}
    </Stack>
  );
}
