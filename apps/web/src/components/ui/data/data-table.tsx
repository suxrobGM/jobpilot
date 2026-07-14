"use client";

import type { ReactElement } from "react";
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
} from "@mui/x-data-grid";

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
}

/**
 * DataGrid wrapper that unwraps the grid's params objects, so callers author
 * row callbacks against their DTO (`(row) => …`) instead of `(p) => p.row`.
 */
export function DataTable<TRow extends GridValidRowModel>(
  props: DataTableProps<TRow>,
): ReactElement {
  const { rows, columns, getRowId, onRowClick, isRowSelectable, ...rest } = props;

  return (
    <DataGrid<TRow>
      {...rest}
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      onRowClick={onRowClick && ((p) => onRowClick(p.row))}
      isRowSelectable={isRowSelectable && ((p) => isRowSelectable(p.row))}
    />
  );
}
