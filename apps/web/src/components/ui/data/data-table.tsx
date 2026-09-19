"use client";

import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@mui/material";
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
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
  /** Set when the query failed, so its empty `rows` do not read as "no data". */
  errorTitle?: string;
  onRetry?: () => void;
  /** Replaces the grid's "No rows" overlay, so every empty table reads like the rest of the app. */
  emptyMessage?: string;
}

interface LoadErrorOverlayProps {
  title: string;
  onRetry?: () => void;
}

function LoadErrorOverlay(props: LoadErrorOverlayProps): ReactElement {
  const { title, onRetry } = props;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "center", height: "100%" }}
    >
      <Typography variant="body2Muted">{title}</Typography>
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

  const mergedSlots = { ...slots };
  if (errorTitle) {
    mergedSlots.noRowsOverlay = () => <LoadErrorOverlay title={errorTitle} onRetry={onRetry} />;
  } else if (emptyMessage) {
    mergedSlots.noRowsOverlay ??= () => <EmptyState variant="inline" title={emptyMessage} />;
  }

  return (
    <DataGrid<TRow>
      {...rest}
      slots={mergedSlots}
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      onRowClick={onRowClick && ((p) => onRowClick(p.row))}
      isRowSelectable={isRowSelectable && ((p) => isRowSelectable(p.row))}
    />
  );
}
