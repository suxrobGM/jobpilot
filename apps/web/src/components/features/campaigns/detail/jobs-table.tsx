"use client";

import type { ReactElement } from "react";
import type { CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { Button, Link } from "@mui/material";
import type { GridColDef, GridPaginationModel, GridRowSelectionModel } from "@mui/x-data-grid";
import type { CampaignJobDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { ColorChip } from "@/components/ui/display";

/** Statuses that can still be applied to from the campaigns detail page. */
function isApplicable(status: CampaignJobStatus): boolean {
  return status === "pending" || status === "approved";
}

/** Statuses eligible for selection + bulk re-apply on a stopped campaign. */
export function isReapplicable(status: CampaignJobStatus): boolean {
  return status !== "applied" && status !== "applying";
}

const STATUS_COLOR: Record<
  CampaignJobStatus,
  "default" | "info" | "primary" | "success" | "error" | "warning"
> = {
  pending: "default",
  approved: "info",
  applying: "primary",
  needs_user: "warning",
  applied: "success",
  failed: "error",
  skipped: "warning",
};

interface CampaignJobsTableProps {
  rows: ReadonlyArray<CampaignJobDto>;
  loading?: boolean;
  /** When provided, applicable rows get an "Apply" action that calls this. */
  onApplyJob?: (job: CampaignJobDto) => void;
  /** When provided, applicable rows get a "Draft proposal" action (Upwork). */
  onDraftProposal?: (job: CampaignJobDto) => void;
  /** Show the match-reason column (recommendation rationale, e.g. Upwork). */
  showReason?: boolean;
  /** Enables checkbox selection (reapplicable rows only). */
  checkboxSelection?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void;
  /** Server-side paging: total row count across the whole campaign, not just `rows`. */
  rowCount: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
}

export function CampaignJobsTable(props: CampaignJobsTableProps): ReactElement {
  const {
    rows,
    loading,
    onApplyJob,
    onDraftProposal,
    showReason,
    checkboxSelection,
    rowSelectionModel,
    onRowSelectionModelChange,
    rowCount,
    paginationModel,
    onPaginationModelChange,
  } = props;
  const columns: GridColDef<CampaignJobDto>[] = [
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (p) => <ColorChip value={p.row.status} colors={STATUS_COLOR} />,
      sortable: false,
    },
    {
      field: "title",
      headerName: "Title",
      flex: 1.4,
      minWidth: 200,
      renderCell: (p) => (
        <Link href={p.row.url} target="_blank" rel="noopener noreferrer" color="inherit">
          {p.row.title}
        </Link>
      ),
    },
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
  ];

  if (showReason) {
    columns.splice(columns.length - 1, 0, {
      field: "matchReason",
      headerName: "Why",
      flex: 1.5,
      minWidth: 220,
      valueGetter: (_v, row) => row.matchReason ?? "",
    });
  }

  if (onApplyJob || onDraftProposal) {
    columns.push({
      field: "actions",
      headerName: "",
      width: onDraftProposal ? 150 : 96,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => {
        if (!isApplicable(p.row.status)) {
          return null;
        }
        if (onApplyJob) {
          return (
            <Button size="small" variant="outlined" onClick={() => onApplyJob(p.row)}>
              Apply
            </Button>
          );
        }
        return (
          <Button size="small" variant="outlined" onClick={() => onDraftProposal?.(p.row)}>
            Draft proposal
          </Button>
        );
      },
    });
  }

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.id}
      checkboxSelection={checkboxSelection}
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={onRowSelectionModelChange}
      isRowSelectable={(row) => isReapplicable(row.status)}
      keepNonExistentRowsSelected
      paginationMode="server"
      rowCount={rowCount}
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
    />
  );
}
