"use client";

import type { ReactElement } from "react";
import { Button, Chip, Link, Stack, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import type { EmailMessageDto } from "@/api/types";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { DataTable } from "@/components/ui/data/data-table";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import type { GridPaginationProps } from "@/hooks/use-pagination";

interface InboxTableProps extends GridPaginationProps {
  rows: ReadonlyArray<EmailMessageDto>;
  loading?: boolean;
  /** Set when the read failed, so empty rows don't read as an empty inbox. */
  errorTitle?: string;
  onRetry?: () => void;
  onRowClick: (row: EmailMessageDto) => void;
}

export function InboxTable(props: InboxTableProps): ReactElement {
  const { rows, loading, errorTitle, onRetry, onRowClick, ...pagination } = props;
  const request = useCreateRequest();

  const columns: GridColDef<EmailMessageDto>[] = [
    {
      field: "from",
      headerName: "From",
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (p) => (
        <Stack spacing={0} sx={{ height: "100%", justifyContent: "center", overflow: "hidden" }}>
          <Typography variant="body2Strong" noWrap sx={{ lineHeight: 1.4 }}>
            {p.row.fromName || p.row.fromAddress}
          </Typography>
          <Typography variant="captionMuted" noWrap sx={{ lineHeight: 1.4 }}>
            {p.row.fromDomain}
          </Typography>
        </Stack>
      ),
    },
    { field: "subject", headerName: "Subject", flex: 1.6, minWidth: 240 },
    {
      field: "classification",
      headerName: "Class",
      width: 160,
      renderCell: (p) => {
        const c = p.row.classification;
        if (!c) {
          return (
            <Typography variant="captionMuted" sx={{ pl: 0.5 }}>
              -
            </Typography>
          );
        }
        return (
          <Stack direction="row" spacing={0.5} sx={{ height: "100%", alignItems: "center" }}>
            <StatusChip domain="classification" value={c} variant="filled" />
            {p.row.reviewStatus === "auto" && <Chip label="auto" variant="outlined" color="info" />}
          </Stack>
        );
      },
    },
    {
      field: "confidence",
      headerName: "Conf.",
      width: 90,
      align: "right",
      headerAlign: "right",
      valueFormatter: (v) => (v == null ? "" : `${Math.round((v as number) * 100)}%`),
    },
    {
      field: "applicationId",
      headerName: "Matched app",
      width: 200,
      sortable: false,
      renderCell: (p) => {
        const matched = p.row.application;
        if (!matched) {
          return (
            <Typography
              variant="captionMuted"
              sx={{ height: "100%", display: "flex", alignItems: "center", pl: 0.5 }}
            >
              -
            </Typography>
          );
        }
        return (
          <Stack spacing={0} sx={{ height: "100%", justifyContent: "center", overflow: "hidden" }}>
            <Link
              href={`/applications/${matched.id}`}
              // The row click opens the review dialog, so this cell has to keep its own.
              onClick={(e) => e.stopPropagation()}
            >
              <Typography variant="body2" noWrap sx={{ lineHeight: 1.4 }}>
                {matched.title}
              </Typography>
            </Link>
            <Typography variant="captionMuted" noWrap sx={{ lineHeight: 1.4 }}>
              {matched.company}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "receivedAt",
      headerName: "Received",
      width: 140,
      renderCell: (p) => <RelativeTime value={p.row.receivedAt} />,
    },
    ...[
      {
        field: "scan",
        headerName: "",
        width: 100,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (p) => (
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => {
              // The row click would open the review dialog.
              e.stopPropagation();
              request.mutate({
                taskType: "inbox.review",
                payload: { messageIds: [p.row.id] },
              });
            }}
          >
            {p.row.classification ? "Rescan" : "Scan"}
          </Button>
        ),
      } satisfies GridColDef<EmailMessageDto>,
    ],
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={loading}
      errorTitle={errorTitle}
      onRetry={onRetry}
      emptyMessage="No messages here yet."
      rowHeight={60}
      onRowClick={onRowClick}
      {...pagination}
    />
  );
}
