"use client";

import { Chip } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { type ReactElement, useMemo } from "react";
import { DataTable } from "@/components/ui/data/data-table";
import type { RunJobStatus } from "@/lib/schemas/run";
import type { RunJobDto } from "@/types/api";

const STATUS_COLOR: Record<RunJobStatus, "default" | "info" | "primary" | "success" | "error" | "warning"> = {
  pending: "default",
  approved: "info",
  applying: "primary",
  applied: "success",
  failed: "error",
  skipped: "warning",
};

interface RunJobsTableProps {
  rows: ReadonlyArray<RunJobDto>;
  loading?: boolean;
}

export function RunJobsTable(props: RunJobsTableProps): ReactElement {
  const { rows, loading } = props;
  const columns = useMemo<GridColDef<RunJobDto>[]>(
    () => [
      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderCell: (p) => (
          <Chip
            size="small"
            label={p.row.status}
            color={STATUS_COLOR[p.row.status]}
            variant="outlined"
          />
        ),
        sortable: false,
      },
      { field: "title", headerName: "Title", flex: 1.4, minWidth: 200 },
      { field: "company", headerName: "Company", flex: 1, minWidth: 160 },
      { field: "board", headerName: "Board", width: 130 },
      {
        field: "matchScore",
        headerName: "Score",
        width: 80,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => row.matchScore ?? "",
      },
      {
        field: "failReason",
        headerName: "Fail reason",
        flex: 1,
        minWidth: 160,
        valueGetter: (_v, row) => row.failReason ?? row.skipReason ?? "",
      },
    ],
    [],
  );
  return (
    <DataTable<RunJobDto>
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.id}
    />
  );
}
