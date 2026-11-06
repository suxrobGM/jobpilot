"use client";

import type { ReactElement } from "react";
import { PIPELINE_VIEW_STATUSES, type PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Stack, Typography } from "@mui/material";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import type { PipelineJobDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import type { GridPaginationProps } from "@/hooks/use-pagination";
import { CapExemptChip } from "./cap-exempt-chip";

/** Views whose rows carry a reason worth a column. */
const REASON_VIEWS: PipelineJobView[] = ["skipped", "failed", "needsYou"];

function scoreLabel(view: PipelineJobView, score: number | null): string {
  if (score !== null) {
    return String(score);
  }
  // Found rows without a score are queued for the pilot's next scoring pass.
  return view === "found" ? "Scoring…" : "";
}

interface PipelineJobsTableProps extends GridPaginationProps {
  view: PipelineJobView;
  rows: ReadonlyArray<PipelineJobDto>;
  loading: boolean;
  onOpen: (job: PipelineJobDto) => void;
  /** Null when the view has no bulk action. */
  selection: GridRowSelectionModel | null;
  onSelectionChange: (selection: GridRowSelectionModel) => void;
}

export function PipelineJobsTable(props: PipelineJobsTableProps): ReactElement {
  const { view, rows, loading, onOpen, selection, onSelectionChange, ...pagination } = props;
  const found = view === "found";
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
      sortable: false,
      valueGetter: (_v, row) => scoreLabel(view, row.matchScore),
    },
    {
      field: "feed",
      headerName: "Feed",
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (p) => <Typography variant="captionMuted">{p.row.feed.name}</Typography>,
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
    // A tab holding a single status says it already.
    ...(PIPELINE_VIEW_STATUSES[view].length > 1
      ? [
          {
            field: "status",
            headerName: "Status",
            width: 120,
            sortable: false,
            renderCell: (p) => <StatusChip domain="job" value={p.row.status} />,
          } satisfies GridColDef<PipelineJobDto>,
        ]
      : []),
    {
      field: found ? "createdAt" : "updatedAt",
      headerName: found ? "Found" : "Updated",
      width: 110,
      align: "right",
      headerAlign: "right",
      sortable: false,
      renderCell: (p) => <RelativeTime value={found ? p.row.createdAt : p.row.updatedAt} />,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.id}
      onRowClick={onOpen}
      checkboxSelection={selection !== null}
      disableRowSelectionOnClick
      {...(selection && {
        rowSelectionModel: selection,
        onRowSelectionModelChange: onSelectionChange,
      })}
      {...pagination}
    />
  );
}
