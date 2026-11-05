import type { ReactElement } from "react";
import { Chip, Link } from "@mui/material";
import type { AdminJobListingDto } from "@/api/types";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { StatusChip } from "@/components/ui/display";
import { formatDate } from "@/utils/format";
import { jobHref } from "@/utils/routes";
import { AdminListingActions } from "./listing-actions";

const COLUMNS: SimpleColumn<AdminJobListingDto>[] = [
  {
    key: "title",
    header: "Title",
    // A new tab, so reviewing a listing keeps the admin's place in this list.
    render: (listing) => (
      <Link href={jobHref(listing.slug)} target="_blank" rel="noopener noreferrer" color="inherit">
        {listing.title}
      </Link>
    ),
  },
  { key: "company", header: "Company", render: (listing) => listing.company },
  {
    key: "location",
    header: "Location",
    render: (listing) =>
      listing.remote ? (
        <Chip variant="outlined" color="success" label="remote" />
      ) : (
        listing.location
      ),
  },
  { key: "boards", header: "Boards", align: "right", render: (listing) => listing.sourceCount },
  {
    key: "status",
    header: "Status",
    render: (listing) => <StatusChip domain="listing" value={listing.status} />,
  },
  {
    key: "lastSeen",
    header: "Last seen",
    nowrap: true,
    render: (listing) => formatDate(listing.lastSeenAt),
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    nowrap: true,
    render: (listing) => <AdminListingActions listing={listing} />,
  },
];

interface AdminListingsTableProps {
  listings: AdminJobListingDto[];
}

/** Server-rendered: the only client leaf is the per-row action menu. */
export function AdminListingsTable(props: AdminListingsTableProps): ReactElement {
  const { listings } = props;
  return (
    <SimpleTable
      columns={COLUMNS}
      rows={listings}
      rowKey={(listing) => listing.id}
      emptyTitle="No listings match the current filters."
    />
  );
}
