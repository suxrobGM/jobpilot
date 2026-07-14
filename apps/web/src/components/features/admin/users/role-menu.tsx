"use client";

import type { ReactElement } from "react";
import type { AssignableRole } from "@jobpilot/contracts/role";
import { MoreVert, PersonRemove, Shield } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { AdminUserDto } from "@/api/types";
import { DropdownMenu } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";

interface AdminRoleMenuProps {
  user: AdminUserDto;
}

/** Rendered only for rows the server marked `canChangeRole`. */
export function AdminRoleMenu(props: AdminRoleMenuProps): ReactElement {
  const { user } = props;
  const router = useRouter();
  const confirm = useConfirm();

  const setRole = useApiMutation<AdminUserDto, AssignableRole>(
    (role) => api.admin.users({ id: user.id }).role.patch({ role }),
    {
      // A promoted user's access token still claims their old role until it refreshes.
      successMessage: "Role updated. The user picks it up on their next sign-in.",
      onSuccess: () => router.refresh(),
    },
  );

  const handleSetRole = async (role: AssignableRole): Promise<void> => {
    const granting = role === "ADMIN";
    const confirmed = await confirm({
      title: granting ? "Make admin?" : "Revoke admin?",
      description: granting
        ? `${user.email} will see the admin area and can manage the board catalog. They cannot change anyone's role.`
        : `${user.email} loses access to the admin area immediately, even on their current session.`,
      confirmLabel: granting ? "Make admin" : "Revoke",
      destructive: !granting,
    });
    if (confirmed) {
      setRole.mutate(role);
    }
  };

  return (
    <DropdownMenu
      trigger={({ onOpen }) => (
        <IconButton onClick={onOpen} aria-label="User actions">
          <MoreVert fontSize="md" />
        </IconButton>
      )}
      items={[
        user.role === "ADMIN"
          ? {
              kind: "item",
              key: "revoke",
              label: "Revoke admin",
              icon: <PersonRemove fontSize="sm" />,
              danger: true,
              onClick: () => void handleSetRole("USER"),
            }
          : {
              kind: "item",
              key: "promote",
              label: "Make admin",
              icon: <Shield fontSize="sm" />,
              onClick: () => void handleSetRole("ADMIN"),
            },
      ]}
    />
  );
}
