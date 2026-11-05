import type { ReactElement } from "react";
import { CheckCircle } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import type { AdminUserDto } from "@/api/types";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { StatusChip } from "@/components/ui/display";
import { formatDate } from "@/utils/format";
import { AdminRoleMenu } from "./role-menu";

const COLUMNS: SimpleColumn<AdminUserDto>[] = [
  {
    key: "email",
    header: "Email",
    render: (user) => (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="inherit">{user.email}</Typography>
        {user.emailVerified && <CheckCircle fontSize="sm" color="success" titleAccess="Verified" />}
      </Stack>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (user) => user.name,
  },
  { key: "role", header: "Role", render: (user) => <StatusChip domain="role" value={user.role} /> },
  {
    key: "applications",
    header: "Applications",
    align: "right",
    render: (user) => user.applicationCount,
  },
  { key: "lastActive", header: "Last active", render: (user) => formatDate(user.lastActiveAt) },
  { key: "joined", header: "Joined", render: (user) => formatDate(user.createdAt) },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    nowrap: true,
    render: (user) => user.canChangeRole && <AdminRoleMenu user={user} />,
  },
];

interface AdminUsersTableProps {
  users: AdminUserDto[];
}

/** Server-rendered: the only client leaf is the role menu, on rows the server says are editable. */
export function AdminUsersTable(props: AdminUsersTableProps): ReactElement {
  const { users } = props;
  return (
    <SimpleTable
      columns={COLUMNS}
      rows={users}
      rowKey={(user) => user.id}
      emptyTitle="No users match this search."
    />
  );
}
