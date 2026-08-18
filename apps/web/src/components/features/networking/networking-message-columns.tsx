import { Button } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import type { NetworkingMessageDto } from "@/api/types";
import { ExternalLink } from "@/components/ui/display";
import { NetworkingStatusChip } from "./networking-status-chip";

/** Shared by a campaign's board and the cross-campaign list, so a draft reads the same in both. */
export const networkingMessageColumns: GridColDef<NetworkingMessageDto>[] = [
  {
    field: "status",
    headerName: "Status",
    width: 110,
    sortable: false,
    renderCell: (p) => <NetworkingStatusChip status={p.row.status} />,
  },
  {
    field: "name",
    headerName: "Contact",
    flex: 1.2,
    minWidth: 180,
    valueGetter: (_v, row) => row.contact.name,
    renderCell: (p) =>
      p.row.contact.linkedinUrl ? (
        <ExternalLink href={p.row.contact.linkedinUrl}>{p.row.contact.name}</ExternalLink>
      ) : (
        p.row.contact.name
      ),
  },
  {
    field: "company",
    headerName: "Company",
    flex: 1,
    minWidth: 140,
    valueGetter: (_v, row) => row.contact.company ?? "",
    renderCell: (p) =>
      p.row.contact.relatedJobUrl ? (
        <ExternalLink href={p.row.contact.relatedJobUrl}>
          {p.row.contact.company ?? "View role"}
        </ExternalLink>
      ) : (
        (p.row.contact.company ?? "")
      ),
  },
  {
    field: "channel",
    headerName: "Channel",
    width: 130,
    valueGetter: (_v, row) =>
      row.channel === "linkedin"
        ? `LinkedIn${row.linkedinKind ? ` · ${row.linkedinKind}` : ""}`
        : "Email",
  },
  {
    field: "subject",
    headerName: "Subject / preview",
    flex: 1.4,
    minWidth: 200,
    valueGetter: (_v, row) => row.subject ?? row.body.slice(0, 80),
  },
];

/** The trailing "Open" cell, shared by the board and the cross-campaign list. */
export function openActionColumn(onOpen: (id: string) => void): GridColDef<NetworkingMessageDto> {
  return {
    field: "actions",
    headerName: "",
    width: 96,
    sortable: false,
    filterable: false,
    align: "right",
    headerAlign: "right",
    renderCell: (p) => (
      <Button size="small" variant="outlined" onClick={() => onOpen(p.row.id)}>
        Open
      </Button>
    ),
  };
}
