"use client";

import type { GridColDef } from "@mui/x-data-grid";
import { Chip } from "@mui/material";
import { useRouter } from "next/navigation";
import { type ReactElement, useMemo } from "react";
import { DataTable } from "@/components/ui/data/data-table";
import type { RunStatus } from "@/lib/schemas/run";
import type { RunDto } from "@/types/api";

const STATUS_COLOR: Record<RunStatus, "default" | "info" | "success" | "error"> = {
  in_progress: "info",
  paused: "default",
  completed: "success",
  failed: "error",
};

interface RunsTableProps {
  rows: ReadonlyArray<RunDto>;
  loading?: boolean;
}

export function RunsTable(props: RunsTableProps): ReactElement {
  const { rows, loading } = props;
  const router = useRouter();

  const columns = useMemo<GridColDef<RunDto>[]>(
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
      { field: "query", headerName: "Query", flex: 1.4, minWidth: 200 },
      { field: "source", headerName: "Source", width: 130 },
      {
        field: "applied",
        headerName: "Applied",
        width: 100,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => row.summary.applied,
      },
      {
        field: "failed",
        headerName: "Failed",
        width: 100,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => row.summary.failed,
      },
      {
        field: "totalFound",
        headerName: "Found",
        width: 100,
        align: "right",
        headerAlign: "right",
        valueGetter: (_v, row) => row.summary.totalFound,
      },
      {
        field: "startedAt",
        headerName: "Started",
        width: 160,
        valueFormatter: (v) =>
          v ? new Date(v as string).toLocaleString() : "",
      },
    ],
    [],
  );

  return (
    <DataTable<RunDto>
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.runId}
      onRowClick={(p) => router.push(`/runs/${encodeURIComponent(p.id as string)}`)}
      sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
    />
  );
}
