import type { ReactElement } from "react";
import { Chip, Stack } from "@mui/material";
import type { AdminBoardDto } from "@/api/types";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { ExternalLink } from "@/components/ui/display";
import { AdminBoardActions } from "./board-actions";

const COLUMNS: SimpleColumn<AdminBoardDto>[] = [
  { key: "name", header: "Name", render: (board) => board.name },
  { key: "domain", header: "Domain", render: (board) => board.domain },
  {
    key: "searchUrl",
    header: "Search URL",
    render: (board) =>
      board.searchUrl && (
        <ExternalLink href={board.searchUrl} truncateTo={240}>
          {board.searchUrl}
        </ExternalLink>
      ),
  },
  {
    key: "visibility",
    header: "Visibility",
    render: (board) => (
      <Stack direction="row" spacing={0.5}>
        <Chip
          variant="outlined"
          color={board.listed ? "primary" : "default"}
          label={board.listed ? "listed" : "unlisted"}
        />
        {board.isDefault && <Chip variant="outlined" color="success" label="default" />}
      </Stack>
    ),
  },
  { key: "adoption", header: "Adoption", align: "right", render: (board) => board.adoption },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    nowrap: true,
    render: (board) => <AdminBoardActions board={board} />,
  },
];

interface AdminBoardsTableProps {
  boards: AdminBoardDto[];
}

/** Server-rendered: the only client leaf is the per-row action menu. */
export function AdminBoardsTable(props: AdminBoardsTableProps): ReactElement {
  const { boards } = props;
  return (
    <SimpleTable
      columns={COLUMNS}
      rows={boards}
      rowKey={(board) => board.id}
      emptyTitle="No boards match the current filters."
    />
  );
}
