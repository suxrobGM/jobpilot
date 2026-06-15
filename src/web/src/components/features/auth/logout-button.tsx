"use client";

import type { ReactElement } from "react";
import { Logout } from "@mui/icons-material";
import { ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import { useAuth } from "@/hooks/use-auth";

interface LogoutMenuItemProps {
  /** Called before the logout request fires (e.g. to close an open menu). */
  onClick?: () => void;
}

/**
 * Sign-out control shaped as a `MenuItem`, intended to live inside the
 * profile-switcher `Menu` in the app rail. Calls `useAuth().logout`, which
 * clears the session cookie and routes to `/login`.
 */
export function LogoutMenuItem(props: LogoutMenuItemProps): ReactElement {
  const { onClick } = props;
  const { logout } = useAuth();

  return (
    <MenuItem
      onClick={() => {
        onClick?.();
        logout.mutate();
      }}
      disabled={logout.isPending}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Logout fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={logout.isPending ? "Signing out…" : "Sign out"} />
    </MenuItem>
  );
}
