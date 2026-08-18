"use client";

import { type ReactElement, useMemo } from "react";
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
  /** Replaces the grid's "No rows" overlay, so every empty table reads like the rest of the app. */
  emptyMessage?: string;
}

/**
 * DataGrid wrapper that unwraps the grid's params objects, so callers author
 * row callbacks against their DTO (`(row) => …`) instead of `(p) => p.row`.
 */
export function DataTable<TRow extends GridValidRowModel>(
  props: DataTableProps<TRow>,
): ReactElement {
  const { rows, columns, getRowId, onRowClick, isRowSelectable, emptyMessage, slots, ...rest } =
    props;

  // A fresh slot component each render would remount the overlay instead of updating it.
  const mergedSlots = useMemo(
    () =>
      emptyMessage
        ? { noRowsOverlay: () => <EmptyState variant="inline" title={emptyMessage} />, ...slots }
        : slots,
    [emptyMessage, slots],
  );

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
