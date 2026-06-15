"use client";

import type { ReactElement } from "react";
import { Launch } from "@mui/icons-material";
import { Chip, IconButton, Link } from "@mui/material";
import { DataGrid, type GridColDef, type GridRowsProp } from "@mui/x-data-grid";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CoverLetterListItem } from "@/api/types";

const SOURCE_COLOR: Record<CoverLetterListItem["source"], "default" | "info" | "success"> = {
  manual: "default",
  apply: "info",
  "auto-apply": "success",
};

export function CoverLettersTable(): ReactElement {
  const router = useRouter();
  const lettersQuery = useApiQuery<CoverLetterListItem[]>(queryKeys.coverLetters.list(), () =>
    apiClient.get<CoverLetterListItem[]>("/api/cover-letters"),
  );

  const rows = lettersQuery.data ?? [];

  const columns: GridColDef<CoverLetterListItem>[] = [
    {
      field: "createdAt",
      headerName: "Date",
      width: 160,
      valueGetter: (_v, row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      field: "company",
      headerName: "Company",
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => row.company ?? "—",
    },
    {
      field: "jobTitle",
      headerName: "Role",
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_v, row) => row.jobTitle ?? "—",
    },
    {
      field: "source",
      headerName: "Source",
      width: 130,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.row.source}
          color={SOURCE_COLOR[p.row.source]}
          variant="outlined"
        />
      ),
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
    <DataGrid
      rows={rows as GridRowsProp}
      columns={columns as GridColDef[]}
      loading={lettersQuery.isLoading}
      getRowId={(row) => (row as CoverLetterListItem).id}
      onRowClick={(p) => router.push(`/cover-letters/${p.id}` as Route)}
    />
  );
}
