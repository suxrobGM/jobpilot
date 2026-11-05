import type { ReactElement } from "react";
import { newTokens } from "@jobpilot/contracts/pilot";
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
import { formatRelativeTime, formatTokens } from "@/utils/format";

interface AdminPilotsTableProps {
  pilots: AdminPilotDto[];
}

export function AdminPilotsTable(props: AdminPilotsTableProps): ReactElement {
  const { pilots } = props;

  if (pilots.length === 0) {
    return <EmptyState variant="inline" title="No Pilots match the current filters." />;
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last cycle</TableCell>
            <TableCell align="right">Cycles</TableCell>
            <TableCell align="right">Open questions</TableCell>
            <TableCell align="right">New tokens (7d)</TableCell>
            <TableCell align="right">Cached (7d)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pilots.map((pilot) => (
            <TableRow key={pilot.userId} hover>
              <TableCell sx={{ fontWeight: 600 }}>{pilot.userEmail}</TableCell>
              <TableCell>
                <Chip
                  color={pilot.running ? "success" : "default"}
                  label={pilot.running ? "Running" : "Stopped"}
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
                  variant={pilot.openQuestions > 0 ? "filled" : "outlined"}
                  color={pilot.openQuestions > 0 ? "error" : "default"}
                  label={pilot.openQuestions}
                />
              </TableCell>
              <TableCell align="right">{formatTokens(newTokens(pilot.weekTokens))}</TableCell>
              <TableCell align="right">
                <Typography variant="body2Muted">
                  {formatTokens(pilot.weekTokens.cacheRead)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
