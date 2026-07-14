import type { ReactElement } from "react";
import { CheckCircle } from "@mui/icons-material";
import {
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { AdminUserDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { formatDate } from "@/utils/format";
import { AdminRoleChip } from "./role-chip";
import { AdminRoleMenu } from "./role-menu";

interface AdminUsersTableProps {
  users: AdminUserDto[];
}

/** Server-rendered: the only client leaf is the role menu, on rows the server says are editable. */
export function AdminUsersTable(props: AdminUsersTableProps): ReactElement {
  const { users } = props;

  if (users.length === 0) {
    return <EmptyState variant="inline" title="No users match this search." />;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell align="right">Applications</TableCell>
            <TableCell>Last active</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <span>{user.email}</span>
                  {user.emailVerified && (
                    <CheckCircle fontSize="sm" color="success" titleAccess="Verified" />
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                {user.name ?? <Typography variant="captionMuted">-</Typography>}
              </TableCell>
              <TableCell>
                <AdminRoleChip role={user.role} />
              </TableCell>
              <TableCell align="right">{user.applicationCount}</TableCell>
              <TableCell>{formatDate(user.lastActiveAt)}</TableCell>
              <TableCell>{formatDate(user.createdAt)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {user.canChangeRole && <AdminRoleMenu user={user} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
