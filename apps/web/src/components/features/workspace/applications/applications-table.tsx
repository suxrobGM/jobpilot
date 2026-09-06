"use client";

import type { ReactElement } from "react";
import type { ApplicationStatus } from "@jobpilot/contracts/application";
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ApplicationDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { StatusChip } from "@/components/ui/display";
import { formatRelativeTime } from "@/utils/format";

interface ApplicationsTableProps {
  rows: ApplicationDto[];
  /** Maps a campaignId to its query, for attribution. */
  campaignLabel: Map<string, string>;
}

export function ApplicationsTable(props: ApplicationsTableProps): ReactElement {
  const { rows, campaignLabel } = props;
  const router = useRouter();

  if (rows.length === 0) {
    return <EmptyState variant="inline" title="No applications match the filters." />;
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Source</TableCell>
            <TableCell align="right">Applied</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((a) => (
            <TableRow
              key={a.id}
              hover
              sx={{ cursor: "pointer" }}
              onClick={() => router.push(`/applications/${a.id}` as Route)}
            >
              <TableCell sx={{ fontWeight: 500 }}>{a.title}</TableCell>
              <TableCell>{a.company}</TableCell>
              <TableCell>
                <StatusChip status={a.status as ApplicationStatus} />
              </TableCell>
              <TableCell>
                <Typography variant="captionMuted">
                  {a.campaignId ? (campaignLabel.get(a.campaignId) ?? a.source) : "Single apply"}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="captionMuted">{formatRelativeTime(a.appliedAt)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
