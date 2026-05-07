"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { DataGrid, type DataGridProps, type GridColDef } from "@mui/x-data-grid";

export interface DataTableProps<T extends Record<string, any> = Record<string, any>> extends Omit<
  DataGridProps<T>,
  "rows" | "columns" | "loading"
> {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<GridColDef<T>>;
  loading?: boolean;
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>(props: DataTableProps<T>): ReactElement {
  const { rows, columns, loading, pageSize = 25, ...rest } = props;
  return (
    <Box
      sx={(t) => ({
        width: "100%",
        "& .MuiDataGrid-root": {
          border: `1px solid ${t.palette.line.divider}`,
          borderRadius: t.radii.md,
          backgroundColor: t.palette.surfaces.card,
        },
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: t.palette.surfaces.elevated,
          fontSize: "0.7rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        },
        "& .MuiDataGrid-cell": { fontSize: "0.875rem" },
      })}
    >
      <DataGrid<T>
        rows={rows as T[]}
        columns={columns as GridColDef<T>[]}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        initialState={{ pagination: { paginationModel: { pageSize } } }}
        pageSizeOptions={[10, 25, 50, 100]}
        {...rest}
      />
    </Box>
  );
}
