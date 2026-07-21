"use client";

import type { ReactElement } from "react";
import { Link } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { useApiQuery } from "@/api/hooks";
import { contactQueries } from "@/api/queries";
import type { ContactDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { NetworkingConnectionChip } from "./networking-status-chip";

export function ContactsTable(): ReactElement {
  const contactsQuery = useApiQuery(contactQueries.list());

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
      renderCell: (p) => <NetworkingConnectionChip connection={p.row.linkedinConnection} />,
    },
    {
      field: "discoverySource",
      headerName: "Source",
      width: 130,
      valueGetter: (_v, row) => row.discoverySource ?? "",
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      loading={contactsQuery.isLoading}
      getRowId={(row) => row.id}
      autoHeight
    />
  );
}
