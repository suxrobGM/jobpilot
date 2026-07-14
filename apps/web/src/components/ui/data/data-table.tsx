"use client";

import type { ReactElement } from "react";
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridRowsProp,
  type GridValidRowModel,
} from "@mui/x-data-grid";

interface DataTableProps<TRow>
  extends Omit<DataGridProps, "rows" | "columns" | "getRowId" | "onRowClick" | "isRowSelectable"> {
  rows: ReadonlyArray<TRow> | undefined;
  columns: ReadonlyArray<GridColDef<TRow & GridValidRowModel>>;
  getRowId?: (row: TRow) => string | number;
  onRowClick?: (row: TRow) => void;
  isRowSelectable?: (row: TRow) => boolean;
}

/**
 * DataGrid wrapper that owns the row-model widening once. Our DTOs are
 * interfaces without an index signature, so they don't satisfy DataGrid's
 * GridValidRowModel constraint. Callers author typed rows/columns/callbacks
 * against their DTO; the cast lives here, at the grid boundary.
 */
export function DataTable<TRow>(props: DataTableProps<TRow>): ReactElement {
  const { rows, columns, getRowId, onRowClick, isRowSelectable, ...rest } = props;

  return (
    <DataGrid
      {...rest}
      rows={(rows ?? []) as GridRowsProp}
      columns={columns as GridColDef[]}
      getRowId={getRowId && ((row) => getRowId(row as TRow))}
      onRowClick={onRowClick && ((p) => onRowClick(p.row as TRow))}
      isRowSelectable={isRowSelectable && ((p) => isRowSelectable(p.row as TRow))}
    />
  );
}
