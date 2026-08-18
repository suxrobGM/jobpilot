"use client";

import type { ReactElement } from "react";
import type { GridColDef } from "@mui/x-data-grid";
import type { ContactDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { ExternalLink } from "@/components/ui/display";
import { NetworkingConnectionChip } from "./networking-status-chip";

interface ContactsTableProps {
  contacts: ReadonlyArray<ContactDto>;
}

const columns: GridColDef<ContactDto>[] = [
  {
    field: "name",
    headerName: "Name",
    flex: 1.1,
    minWidth: 160,
    renderCell: (p) =>
      p.row.linkedinUrl ? (
        <ExternalLink href={p.row.linkedinUrl}>{p.row.name}</ExternalLink>
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

export function ContactsTable(props: ContactsTableProps): ReactElement {
  const { contacts } = props;

  return (
    <DataTable
      rows={contacts}
      columns={columns}
      getRowId={(row) => row.id}
      autoHeight
      hideFooter
      emptyMessage="No contacts yet - run a networking campaign to discover some."
    />
  );
}
