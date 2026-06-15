"use client";

import type { ReactElement } from "react";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridRowsProp } from "@mui/x-data-grid";
import type { EmailMessageDto } from "@/api/types";

interface InboxTableProps {
  rows: ReadonlyArray<EmailMessageDto>;
  loading?: boolean;
  onRowClick: (row: EmailMessageDto) => void;
  /** When provided, each row gets a Scan/Rescan action that calls this. */
  onScanMessage?: (row: EmailMessageDto) => void;
}

const CLASS_COLORS: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  interviewing: "primary",
  offer: "success",
  rejected: "error",
  verification: "warning",
  irrelevant: "default",
};

export function InboxTable(props: InboxTableProps): ReactElement {
  const { rows, loading, onRowClick, onScanMessage } = props;

  const columns: GridColDef<EmailMessageDto>[] = [
    {
      field: "from",
      headerName: "From",
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (p) => (
        <Stack spacing={0} sx={{ height: "100%", justifyContent: "center", overflow: "hidden" }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.4 }}>
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
              —
            </Typography>
          );
        }
        const color = CLASS_COLORS[c] ?? "default";
        return (
          <Stack direction="row" spacing={0.5} sx={{ height: "100%", alignItems: "center" }}>
            <Chip size="small" label={c} color={color} />
            {p.row.reviewStatus === "auto" && (
              <Chip size="small" label="auto" variant="outlined" color="info" />
            )}
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
      field: "matchedAppId",
      headerName: "Matched app",
      width: 200,
      sortable: false,
      renderCell: (p) => {
        const matched = (
          p.row as EmailMessageDto & {
            matchedApp?: { title: string; company: string } | null;
          }
        ).matchedApp;
        if (!matched) {
          return (
            <Typography
              variant="captionMuted"
              sx={{ height: "100%", display: "flex", alignItems: "center", pl: 0.5 }}
            >
              —
            </Typography>
          );
        }
        return (
          <Stack spacing={0} sx={{ height: "100%", justifyContent: "center", overflow: "hidden" }}>
            <Typography variant="body2" noWrap sx={{ lineHeight: 1.4 }}>
              {matched.title}
            </Typography>
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
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : ""),
    },
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
            // Don't open the review dialog (row click) when scanning.
            e.stopPropagation();
            onScanMessage?.(p.row);
          }}
        >
          {p.row.classification ? "Rescan" : "Scan"}
        </Button>
      ),
    },
  ];

  // DTOs are interfaces without an index signature, so widen rows/columns at
  // the grid boundary; columns above stay typed against EmailMessageDto.
  return (
    <DataGrid
      rows={rows as GridRowsProp}
      columns={columns as GridColDef[]}
      loading={loading}
      rowHeight={60}
      onRowClick={(p) => onRowClick(p.row as EmailMessageDto)}
    />
  );
}
