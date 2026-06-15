"use client";

import type { ReactElement } from "react";
import { Chip, Link } from "@mui/material";
import { DataGrid, type GridColDef, type GridRowsProp } from "@mui/x-data-grid";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ContactDto } from "@/api/types";

const CONNECTION_COLOR: Record<ContactDto["linkedinConnection"], "default" | "info" | "success"> = {
  none: "default",
  pending: "info",
  connected: "success",
};

export function ContactsTable(): ReactElement {
  const contactsQuery = useApiQuery<ContactDto[]>(queryKeys.contacts.list(), () =>
    apiClient.get<ContactDto[]>("/api/contacts"),
  );

  const rows = contactsQuery.data ?? [];

  const columns: GridColDef<ContactDto>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1.1,
      minWidth: 160,
      renderCell: (p) =>
        p.row.linkedinUrl ? (
          <Link href={p.row.linkedinUrl} target="_blank" rel="noopener noreferrer" color="inherit">
            {p.row.name}
          </Link>
        ) : (
          p.row.name
        ),
    },
    { field: "title", headerName: "Title", flex: 1, minWidth: 140 },
    { field: "company", headerName: "Company", flex: 1, minWidth: 140 },
    {
      field: "email",
      headerName: "Email",
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_v, row) => row.email ?? "",
    },
    {
      field: "linkedinConnection",
      headerName: "LinkedIn",
      width: 130,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.row.linkedinConnection}
          color={CONNECTION_COLOR[p.row.linkedinConnection]}
          variant="outlined"
        />
      ),
    },
    {
      field: "discoverySource",
      headerName: "Source",
      width: 130,
      valueGetter: (_v, row) => row.discoverySource ?? "",
    },
  ];

  return (
    <DataGrid
      rows={rows as GridRowsProp}
      columns={columns as GridColDef[]}
      loading={contactsQuery.isLoading}
      getRowId={(row) => (row as ContactDto).id}
      autoHeight
    />
  );
}
