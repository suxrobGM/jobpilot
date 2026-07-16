import type { ReactElement } from "react";
import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { AdminPilotDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { formatRelativeTime } from "@/utils/format";

interface AdminPilotsTableProps {
  pilots: AdminPilotDto[];
}

/** Server-rendered fleet view: no per-row actions yet, so there is no client leaf. */
export function AdminPilotsTable(props: AdminPilotsTableProps): ReactElement {
  const { pilots } = props;

  if (pilots.length === 0) {
    return <EmptyState variant="inline" title="No Pilots match the current filters." />;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Enabled</TableCell>
            <TableCell>Last cycle</TableCell>
            <TableCell align="right">Cycles</TableCell>
            <TableCell align="right">Open questions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pilots.map((pilot) => (
            <TableRow key={pilot.profileId} hover>
              <TableCell sx={{ fontWeight: 600 }}>{pilot.userEmail}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={pilot.enabled ? "success" : "default"}
                  label={pilot.enabled ? "Enabled" : "Disabled"}
                />
              </TableCell>
              <TableCell>
                {pilot.lastCycleAt ? (
                  `${formatRelativeTime(pilot.lastCycleAt)} ago`
                ) : (
                  <Typography variant="captionMuted">-</Typography>
                )}
              </TableCell>
              <TableCell align="right">{pilot.cycleCount}</TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  variant={pilot.openQuestions > 0 ? "filled" : "outlined"}
                  color={pilot.openQuestions > 0 ? "error" : "default"}
                  label={pilot.openQuestions}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
