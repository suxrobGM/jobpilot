"use client";

import type { ReactElement } from "react";
import { Launch } from "@mui/icons-material";
import { IconButton, Link } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/api/hooks";
import { coverLetterQueries } from "@/api/queries";
import type { CoverLetterListItem } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { ColorChip, RelativeTime } from "@/components/ui/display";

const SOURCE_COLOR: Record<CoverLetterListItem["source"], "default" | "info" | "success"> = {
  manual: "default",
  apply: "info",
  "auto-apply": "success",
};

export function CoverLettersTable(): ReactElement {
  const router = useRouter();
  const lettersQuery = useApiQuery(coverLetterQueries.list());

  const rows = lettersQuery.data ?? [];

  const columns: GridColDef<CoverLetterListItem>[] = [
    {
      field: "createdAt",
      headerName: "Date",
      width: 160,
      renderCell: (p) => <RelativeTime value={p.row.createdAt} />,
    },
    {
      field: "company",
      headerName: "Company",
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => row.company ?? "-",
    },
    {
      field: "jobTitle",
      headerName: "Role",
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_v, row) => row.jobTitle ?? "-",
    },
    {
      field: "source",
      headerName: "Source",
      width: 130,
      renderCell: (p) => <ColorChip value={p.row.source} colors={SOURCE_COLOR} />,
    },
    {
      field: "jobUrl",
      headerName: "Job",
      width: 80,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (p) =>
        p.row.jobUrl ? (
          <IconButton
            size="small"
            component={Link}
            href={p.row.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open job posting"
          >
            <Launch fontSize="sm" />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={lettersQuery.isLoading}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(`/cover-letters/${row.id}` as Route)}
    />
  );
}
