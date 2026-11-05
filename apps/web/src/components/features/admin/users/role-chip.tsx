import type { ReactElement } from "react";
import type { Role } from "@jobpilot/contracts/role";
import { ColorChip } from "@/components/ui/display";

interface AdminRoleChipProps {
  role: Role;
}

// Typed by Role, so a new role is a compile error here rather than a silently grey chip.
const COLOR: Record<Role, "warning" | "primary" | "default"> = {
  super_admin: "warning",
  admin: "primary",
  user: "default",
};

export function AdminRoleChip(props: AdminRoleChipProps): ReactElement {
  const { role } = props;

  return <ColorChip value={role} colors={COLOR} label={role.toLowerCase()} />;
}
