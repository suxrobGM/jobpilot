import type { ReactElement } from "react";
import { newTokens } from "@jobpilot/contracts/pilot";
import { Chip, Typography } from "@mui/material";
import type { AdminPilotDto } from "@/api/types";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { RelativeTime } from "@/components/ui/display";
import { formatTokens } from "@/utils/format";

const COLUMNS: SimpleColumn<AdminPilotDto>[] = [
  { key: "email", header: "Email", render: (pilot) => pilot.userEmail },
  {
    key: "status",
    header: "Status",
    render: (pilot) => (
      <Chip
        color={pilot.autopilot ? "success" : "default"}
        label={pilot.autopilot ? "Autopilot" : "Manual"}
      />
    ),
  },
  {
    key: "lastCycle",
    header: "Last cycle",
    render: (pilot) =>
      pilot.lastCycleAt && <RelativeTime value={pilot.lastCycleAt} variant="inherit" />,
  },
  { key: "cycles", header: "Cycles", align: "right", render: (pilot) => pilot.cycleCount },
  {
    key: "questions",
    header: "Open questions",
    align: "right",
    render: (pilot) => (
      <Chip
        variant={pilot.openQuestions > 0 ? "filled" : "outlined"}
        color={pilot.openQuestions > 0 ? "error" : "default"}
        label={pilot.openQuestions}
      />
    ),
  },
  {
    key: "newTokens",
    header: "New tokens (7d)",
    align: "right",
    render: (pilot) => formatTokens(newTokens(pilot.weekTokens)),
  },
  {
    key: "cached",
    header: "Cached (7d)",
    align: "right",
    render: (pilot) => (
      <Typography variant="body2Muted">{formatTokens(pilot.weekTokens.cacheRead)}</Typography>
    ),
  },
];

interface AdminPilotsTableProps {
  pilots: AdminPilotDto[];
}

export function AdminPilotsTable(props: AdminPilotsTableProps): ReactElement {
  const { pilots } = props;
  return (
    <SimpleTable
      columns={COLUMNS}
      rows={pilots}
      rowKey={(pilot) => pilot.userId}
      emptyTitle="No Pilots match the current filters."
    />
  );
}
