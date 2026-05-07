"use client";

import type { ReactElement } from "react";
import type { GridColDef } from "@mui/x-data-grid";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data/data-table";
import { StageChip } from "@/components/ui/display/stage-chip";
import type { ApplicationDto } from "@/types/api";

interface ApplicationsTableProps {
  rows: ReadonlyArray<ApplicationDto>;
  loading?: boolean;
}

export function ApplicationsTable(props: ApplicationsTableProps): ReactElement {
  const { rows, loading } = props;
  const router = useRouter();

  const columns: GridColDef<ApplicationDto>[] = [
    {
      field: "stage",
      headerName: "Stage",
      width: 160,
      renderCell: (p) => <StageChip stage={p.row.stage} />,
      sortable: false,
    },
    { field: "title", headerName: "Title", flex: 1.4, minWidth: 200 },
    { field: "company", headerName: "Company", flex: 1, minWidth: 160 },
    { field: "board", headerName: "Board", width: 140 },
    { field: "source", headerName: "Source", width: 120 },
    {
      field: "matchScore",
      headerName: "Score",
      width: 80,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => row.matchScore ?? "",
    },
    {
      field: "appliedAt",
      headerName: "Applied",
      width: 140,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleDateString() : ""),
    },
  ];

  return (
    <DataTable<ApplicationDto>
      rows={rows}
      columns={columns}
      loading={loading}
      onRowClick={(p) => router.push(`/applications/${p.id}`)}
      sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
    />
  );
}
