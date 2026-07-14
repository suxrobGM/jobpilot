import type { ReactElement } from "react";
import {
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { AdminBoardDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { ExternalLink } from "@/components/ui/display";
import { AdminBoardActions } from "./board-actions";

interface AdminBoardsTableProps {
  boards: AdminBoardDto[];
}

/** Server-rendered: the only client leaf is the per-row action menu. */
export function AdminBoardsTable(props: AdminBoardsTableProps): ReactElement {
  const { boards } = props;

  if (boards.length === 0) {
    return <EmptyState variant="inline" title="No boards match the current filters." />;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Domain</TableCell>
            <TableCell>Search URL</TableCell>
            <TableCell>Visibility</TableCell>
            <TableCell align="right">Adoption</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {boards.map((board) => (
            <TableRow key={board.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{board.name}</TableCell>
              <TableCell>{board.domain}</TableCell>
              <TableCell>
                {board.searchUrl ? (
                  <ExternalLink href={board.searchUrl} truncateTo={240}>
                    {board.searchUrl}
                  </ExternalLink>
                ) : (
                  <Typography variant="captionMuted">-</Typography>
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={board.listed ? "primary" : "default"}
                    label={board.listed ? "listed" : "unlisted"}
                  />
                  {board.isDefault && (
                    <Chip size="small" variant="outlined" color="success" label="default" />
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right">{board.adoption}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <AdminBoardActions board={board} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
