"use client";

import type { ReactElement } from "react";
import { Launch } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { coverLetterQueries } from "@/api/queries";
import type { CoverLetterListItem } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { gridPagination, usePaginationParams } from "@/hooks/use-pagination";
import { coverLetterHref } from "@/utils/routes";

export function CoverLettersTable(): ReactElement {
  const router = useRouter();
  const pagination = usePaginationParams();
  const lettersQuery = useQuery(coverLetterQueries.list(pagination.query));

  const rows = lettersQuery.data?.items ?? [];

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
      renderCell: (p) => <StatusChip domain="source" value={p.row.source} />,
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
            href={p.row.jobUrl}
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
      errorTitle={lettersQuery.isError ? "Couldn't load your cover letters." : undefined}
      onRetry={() => void lettersQuery.refetch()}
      getRowId={(row) => row.id}
      onRowClick={(row) => router.push(coverLetterHref(row.id))}
      {...gridPagination(pagination, lettersQuery.data?.pagination)}
    />
  );
}
