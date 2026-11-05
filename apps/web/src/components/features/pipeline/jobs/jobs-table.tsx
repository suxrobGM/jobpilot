"use client";

import type { ReactElement } from "react";
import type { PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Stack, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import type { PipelineJobDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import type { GridPaginationProps } from "@/hooks/use-pagination";
import { CapExemptChip } from "./cap-exempt-chip";

/** Views whose rows carry a reason worth a column. */
const REASON_VIEWS: PipelineJobView[] = ["skipped", "failed", "needsYou"];

interface PipelineJobsTableProps extends GridPaginationProps {
  view: PipelineJobView;
  rows: ReadonlyArray<PipelineJobDto>;
  loading: boolean;
  onOpen: (job: PipelineJobDto) => void;
}

export function PipelineJobsTable(props: PipelineJobsTableProps): ReactElement {
  const { view, rows, loading, onOpen, ...pagination } = props;
  const columns: GridColDef<PipelineJobDto>[] = [
    {
      field: "title",
      headerName: "Job",
      flex: 1.6,
      minWidth: 220,
      renderCell: (p) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", height: "100%" }}>
          <Typography variant="body2" noWrap>
            {p.row.title}
          </Typography>
          <CapExemptChip job={p.row} />
        </Stack>
      ),
    },
    { field: "company", headerName: "Company", flex: 1, minWidth: 150 },
    {
      field: "matchScore",
      headerName: "Score",
      width: 80,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => row.matchScore ?? "",
    },
    {
      field: "campaign",
      headerName: "From",
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (p) => <Typography variant="captionMuted">{p.row.campaign.query}</Typography>,
    },
    ...(REASON_VIEWS.includes(view)
      ? [
          {
            field: "reason",
            headerName: "Reason",
            flex: 1.4,
            minWidth: 200,
            sortable: false,
            valueGetter: (_v, row) => row.failReason ?? row.skipReason ?? "",
          } satisfies GridColDef<PipelineJobDto>,
        ]
      : []),
    {
      field: "status",
      headerName: "Status",
      width: 120,
      sortable: false,
      renderCell: (p) => <StatusChip domain="campaignJob" value={p.row.status} />,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      width: 110,
      align: "right",
      headerAlign: "right",
      sortable: false,
      renderCell: (p) => <RelativeTime value={p.row.updatedAt} />,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.id}
      onRowClick={onOpen}
      {...pagination}
    />
  );
}
