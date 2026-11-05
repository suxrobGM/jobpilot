"use client";

import type { ReactElement } from "react";
import { Logout } from "@mui/icons-material";
import { ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import { useAuthActions } from "@/hooks/use-auth";

interface LogoutMenuItemProps {
  /** Called before the logout request fires (e.g. to close an open menu). */
  onClick?: () => void;
}

export function LogoutMenuItem(props: LogoutMenuItemProps): ReactElement {
  const { onClick } = props;
  const { logout } = useAuthActions();

  return (
    <MenuItem
      onClick={() => {
        onClick?.();
        logout.mutate();
      }}
      disabled={logout.isPending}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Logout fontSize="md" />
      </ListItemIcon>
      <ListItemText primary={logout.isPending ? "Signing out…" : "Sign out"} />
    </MenuItem>
  );
}
