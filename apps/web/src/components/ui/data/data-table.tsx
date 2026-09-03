"use client";

import { type HTMLAttributes, type ReactElement, useMemo } from "react";
import { Button, Stack, Typography } from "@mui/material";
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
  type NoRowsOverlayPropsOverrides,
} from "@mui/x-data-grid";
import { EmptyState } from "./empty-state";

interface DataTableProps<TRow extends GridValidRowModel>
  extends Omit<
    DataGridProps<TRow>,
    "rows" | "columns" | "getRowId" | "onRowClick" | "isRowSelectable"
  > {
  rows: ReadonlyArray<TRow>;
  columns: ReadonlyArray<GridColDef<TRow>>;
  getRowId?: (row: TRow) => string | number;
  onRowClick?: (row: TRow) => void;
  isRowSelectable?: (row: TRow) => boolean;
  /**
   * Set it when the feeding query failed. A failed fetch leaves `rows` empty, and the grid's
   * own overlay would then say "No rows" - which is a claim about the data, not about the fetch.
   */
  errorTitle?: string;
  onRetry?: () => void;
  /** Replaces the grid's "No rows" overlay, so every empty table reads like the rest of the app. */
  emptyMessage?: string;
}

// The grid passes slot props through this interface; without the augmentation our two extra
// props are not assignable to `noRowsOverlay`.
declare module "@mui/x-data-grid" {
  interface NoRowsOverlayPropsOverrides {
    errorTitle?: string;
    onRetry?: () => void;
  }
}

type LoadErrorOverlayProps = HTMLAttributes<HTMLDivElement> & NoRowsOverlayPropsOverrides;

function LoadErrorOverlay(props: LoadErrorOverlayProps): ReactElement {
  const { errorTitle, onRetry } = props;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "center", height: "100%" }}
    >
      <Typography variant="body2Muted">{errorTitle}</Typography>
      {onRetry && (
        <Button variant="text" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Stack>
  );
}

/**
 * DataGrid wrapper that unwraps the grid's params objects, so callers author
 * row callbacks against their DTO (`(row) => …`) instead of `(p) => p.row`.
 */
export function DataTable<TRow extends GridValidRowModel>(
  props: DataTableProps<TRow>,
): ReactElement {
  const {
    rows,
    columns,
    getRowId,
    onRowClick,
    isRowSelectable,
    errorTitle,
    onRetry,
    emptyMessage,
    slots,
    ...rest
  } = props;

  // An error outranks an empty message: a failed fetch also leaves `rows` empty, and the emptiness
  // copy would then be a claim about the data rather than about the fetch.
  // A fresh slot component each render would remount the overlay instead of updating it.
  const mergedSlots = useMemo(() => {
    if (errorTitle) {
      return { ...slots, noRowsOverlay: LoadErrorOverlay };
    }
    return emptyMessage
      ? { noRowsOverlay: () => <EmptyState variant="inline" title={emptyMessage} />, ...slots }
      : slots;
  }, [errorTitle, emptyMessage, slots]);
  const slotProps = errorTitle
    ? { ...rest.slotProps, noRowsOverlay: { errorTitle, onRetry } }
    : rest.slotProps;

  return (
    <DataGrid<TRow>
      {...rest}
      slots={mergedSlots}
      slotProps={slotProps}
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      onRowClick={onRowClick && ((p) => onRowClick(p.row))}
      isRowSelectable={isRowSelectable && ((p) => isRowSelectable(p.row))}
    />
  );
}
