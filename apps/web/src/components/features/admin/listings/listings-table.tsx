import type { ReactElement } from "react";
import {
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { AdminJobListingDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { formatDate } from "@/utils/format";
import { AdminListingActions } from "./listing-actions";
import { ListingStatusChip } from "./listing-status-chip";

interface AdminListingsTableProps {
  listings: AdminJobListingDto[];
}

/** Server-rendered: the only client leaf is the per-row action menu. */
export function AdminListingsTable(props: AdminListingsTableProps): ReactElement {
  const { listings } = props;

  if (listings.length === 0) {
    return <EmptyState variant="inline" title="No listings match the current filters." />;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>Location</TableCell>
            <TableCell align="right">Boards</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last seen</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {listings.map((listing) => (
            <TableRow key={listing.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>
                <Link href={`/jobs/${listing.slug}`} target="_blank" rel="noopener">
                  {listing.title}
                </Link>
              </TableCell>
              <TableCell>{listing.company}</TableCell>
              <TableCell>
                {listing.remote ? (
                  <Chip size="small" variant="outlined" color="success" label="remote" />
                ) : (
                  (listing.location ?? <Typography variant="captionMuted">-</Typography>)
                )}
              </TableCell>
              <TableCell align="right">{listing.sourceCount}</TableCell>
              <TableCell>
                <ListingStatusChip status={listing.status} />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(listing.lastSeenAt)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <AdminListingActions listing={listing} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
