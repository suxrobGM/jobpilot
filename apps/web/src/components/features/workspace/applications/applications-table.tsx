"use client";

import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import type { ApplicationDto } from "@/api/types";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { applicationHref } from "@/utils/routes";

interface ApplicationsTableProps {
  rows: ApplicationDto[];
  /** Maps a campaignId to its query, for attribution. */
  campaignLabel: Map<string, string>;
}

export function ApplicationsTable(props: ApplicationsTableProps): ReactElement {
  const { rows, campaignLabel } = props;

  const columns: SimpleColumn<ApplicationDto>[] = [
    { key: "role", header: "Role", render: (a) => a.title },
    { key: "company", header: "Company", render: (a) => a.company },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusChip domain="application" value={a.status} />,
    },
    {
      key: "source",
      header: "Source",
      render: (a) => (
        <Typography variant="captionMuted">
          {a.campaignId ? (campaignLabel.get(a.campaignId) ?? a.source) : "Single apply"}
        </Typography>
      ),
    },
    {
      key: "applied",
      header: "Applied",
      align: "right",
      nowrap: true,
      render: (a) => <RelativeTime value={a.appliedAt} />,
    },
  ];

  return (
    <SimpleTable
      columns={columns}
      rows={rows}
      rowKey={(a) => a.id}
      rowHref={(a) => applicationHref(a.id)}
      emptyTitle="No applications match the filters."
    />
  );
}
